import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readCampaignOptions, researchAdExamples, COMPETITOR_DIRECTION } from '../dist/lib/adResearch.js';
import { readMetaSearch, searchMetaAds, metaLibraryConfigured } from '../dist/lib/metaAdLibrary.js';
import { createAdResearchRouter } from '../dist/routes/adResearch.js';
const options={goal:'leads',competitorExamples:[{id:'12345',pageName:'Przykładowa firma',text:'Poznaj kolekcję i wybierz zapach.',source:'manual'}]};
const report={observations:[{observation:'Tekst zachęca do wyboru konkretnego wariantu.',evidenceIds:['12345']}],tests:[{hypothesis:'Konkretny wybór może zwiększyć liczbę zapytań.',variantA:'Ogólne poznaj ofertę',variantB:'Wybierz zapach',metric:'Koszt kwalifikowanego zapytania'}]};
test('validates up to six separate competitor examples without treating them as offer facts',()=>{
 assert.deepEqual(readCampaignOptions(options),options);assert.deepEqual(readCampaignOptions({}),{goal:'auto',competitorExamples:[]});
 for(const change of [{goal:'guaranteed-sales'},{competitorExamples:Array(7).fill(options.competitorExamples[0])},{competitorExamples:[{...options.competitorExamples[0],text:'x'.repeat(2001)}]},{competitorExamples:[options.competitorExamples[0],options.competitorExamples[0]]}])assert.throws(()=>readCampaignOptions({...options,...change}));
 assert.match(COMPETITOR_DIRECTION,/never evidence/);assert.match(COMPETITOR_DIRECTION,/Do not infer conversion/);
});
test('research uses the actual offer and ad texts, with separate evidence and hypotheses',async()=>{
 const result=await researchAdExamples(async request=>{const input=JSON.parse(request.input);assert.equal(input.ourOffer,'Ręcznie robione świece');assert.deepEqual(input.competitorExamples,options.competitorExamples);assert.match(request.instructions,/Nie widzisz grafik/);assert.equal(request.model,'gpt-5.6-luna');return report;},'Ręcznie robione świece',options,new AbortController().signal);
 assert.deepEqual(result,report);
 await assert.rejects(researchAdExamples(async()=>({...report,observations:[{observation:'tekst',evidenceIds:['unknown']}]}),'Świece',options,new AbortController().signal),/nieznane źródło/);
 await assert.rejects(researchAdExamples(async()=>report,'',options,new AbortController().signal),/opisz/);
});
test('Meta search accepts arbitrary topics and optional numeric page IDs but limits markets and inputs',()=>{
 assert.deepEqual(readMetaSearch({query:'kosmetyki naturalne'}),{query:'kosmetyki naturalne',country:'PL',pageId:''});
 assert.equal(readMetaSearch({pageId:'1234567',country:'DE'}).pageId,'1234567');
 for(const body of [{query:'x'},{query:'x'.repeat(121)},{query:'test',country:'US'},{pageId:'https://evil.test'}])assert.throws(()=>readMetaSearch(body));
 assert.equal(metaLibraryConfigured('secret','v24.0'),true);assert.equal(metaLibraryConfigured('','v24.0'),false);assert.equal(metaLibraryConfigured('secret','https://evil.test'),false);
});
test('Meta connector uses a fixed Graph host, bearer header and safe links, never token-bearing snapshot/paging URLs',async()=>{
 let calls=0;
 const result=await searchMetaAds(readMetaSearch({query:'Świece & pielęgnacja',country:'PL'}),'secret-token','v24.0',new AbortController().signal,async(url,init)=>{
  calls++;assert.equal(url.hostname,'graph.facebook.com');assert.equal(url.searchParams.get('search_terms'),'Świece & pielęgnacja');assert.equal(url.searchParams.get('ad_reached_countries'),'["PL"]');assert.equal(url.searchParams.get('access_token'),null);assert.equal(init.headers.Authorization,'Bearer secret-token');assert.equal(init.redirect,'error');
  return Response.json({data:[{id:'12345',page_name:'Marka',ad_creative_bodies:['Przykładowa reklama'],ad_delivery_start_time:'2026-10-01T00:00:00+0000',publisher_platforms:['facebook','instagram'],ad_snapshot_url:'https://facebook.com/private?access_token=secret-token'},{id:'javascript:bad',ad_creative_bodies:['bad']},{id:'67890'}],paging:{next:'https://graph.facebook.com/?access_token=secret-token'}});
 });
 assert.equal(calls,1);assert.equal(result.ads.length,1);assert.equal(result.ads[0].url,'https://www.facebook.com/ads/library/?id=12345');assert.equal(result.ads[0].startDate,'2026-10-01');assert.equal(result.limited,true);assert(!JSON.stringify(result).includes('secret-token'));
 await assert.rejects(searchMetaAds(readMetaSearch({query:'test'}),'','v24.0',new AbortController().signal,async()=>{throw new Error('must not fetch');}),{status:503});
});
test('provider errors never leak Meta response messages containing secrets',async()=>{
 await assert.rejects(searchMetaAds(readMetaSearch({query:'test'}),'secret-token','v24.0',new AbortController().signal,async()=>Response.json({error:{message:'secret-token'}},{status:401})),error=>error.status===502&&!error.message.includes('secret-token'));
});
async function withApi(overrides,action){
 let calls=0;const app=express();app.use(express.json());app.use(createAdResearchRouter({authenticate:(req,res,next)=>{req.authUser={id:'test-user',email:null};next();},authorize:(_req,_res,next)=>next(),quota:{consume:async()=>({claimed:true,remaining:0,nextAvailableAt:new Date(Date.now()+604800000).toISOString(),limit:1,windowDays:7})},subjects:()=>['ip','account'],apiAvailable:()=>true,configured:()=>false,search:async()=>{calls++;return{ads:[],limited:false};},research:async()=>{calls++;return report;},...overrides}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(route,body)=>fetch(`${base}/ad-generator/library/${route}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{await action({base,post,calls:()=>calls});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('all research routes enforce server entitlement before invoking any provider',async()=>{
 await withApi({authorize:(_req,res)=>res.status(403).json({error:'paid package required'})},async({base,post,calls})=>{assert.equal((await fetch(`${base}/ad-generator/library/status`)).status,403);assert.equal((await post('search',{query:'świece'})).status,403);assert.equal((await post('analyze',{...options,text:'Nasza oferta'})).status,403);assert.equal(calls(),0);});
});
test('missing connector configuration is explicit while manual research remains usable',async()=>{
 await withApi({},async({base,post,calls})=>{
  const status=await fetch(`${base}/ad-generator/library/status`);assert.equal(status.headers.get('cache-control'),'no-store');assert.equal((await status.json()).configured,false);
  assert.equal((await post('search',{query:'Dowolna branża'})).status,503);assert.equal(calls(),0);
  assert.equal((await post('analyze',{text:'Nasza własna oferta',...options})).status,200);assert.equal(calls(),1);
  assert.equal((await post('analyze',{text:'',...options})).status,400);assert.equal(calls(),1);
 });
});
