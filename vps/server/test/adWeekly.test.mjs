import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAdPromptGeneratorRouter } from '../dist/routes/adPromptGenerator.js';
import { adQuotaSubjects, normalizeAdIp } from '../dist/lib/adWeeklyAccess.js';
import { cappedCouponDiscount } from '../dist/lib/couponLimits.js';
import { createMeteredAdClient, estimateAdCost } from '../dist/lib/adUsage.js';

const quota={remaining:0,nextAvailableAt:new Date(Date.now()+604800000).toISOString(),limit:1,windowDays:7};
const available={...quota,remaining:1,nextAvailableAt:null};
async function withApi(overrides,action){
  let calls=0,claims=0;
  const app=express();app.use(express.json());app.use(createAdPromptGeneratorRouter({
    authenticate:(req,_res,next)=>{req.authUser={id:'weekly-test',email:null};next();},
    apiKey:()=> 'test-not-a-key',subjects:()=>['ip','account'],
    quota:{status:async()=>available,consume:async(scope)=>{assert.equal(scope,'campaign');return{...quota,claimed:++claims===1};}},
    generate:async()=>{calls++;return{prompts:[{title:'Saved',hookPl:'Offer',prompt:'Text'}]};},
    save:async()=>null,latest:async()=>[],...overrides,
  }));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/ad-generator`;
  const post=body=>fetch(`${base}/generate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{await action({post,base,calls:()=>calls,claims:()=>claims});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('invalid inputs do not claim a quota; second valid request is blocked before provider',async()=>{
  await withApi({},async({post,calls,claims})=>{
    assert.equal((await post({})).status,400);assert.equal(claims(),0);
    const first=await post({text:'Oferta'});assert.equal(first.status,200);assert.equal((await first.json()).creditsUsed,0);
    const second=await post({text:'Inna oferta',paid:true,isAdmin:true});assert.equal(second.status,429);
    assert.equal((await second.json()).code,'AD_WEEKLY_LIMIT');assert(+second.headers.get('retry-after')>0);assert.equal(calls(),1);
  });
});
test('quota database failure and missing API configuration prevent provider calls',async()=>{
  await withApi({quota:{status:async()=>{throw Error('secret');},consume:async()=>{throw Error('secret');}}},async({post,base,calls})=>{
    assert.equal((await fetch(`${base}/access`)).status,503);
    const res=await post({text:'Oferta'});assert.equal(res.status,502);assert(!(await res.text()).includes('secret'));assert.equal(calls(),0);
  });
  await withApi({apiKey:()=>''},async({post,claims})=>{assert.equal((await post({text:'Oferta'})).status,503);assert.equal(claims(),0);});
});
test('access returns separate limits and the authenticated user saved session',async()=>{
  await withApi({latest:async(id,limit)=>{assert.equal(id,'weekly-test');assert.equal(limit,1);return[{id:'saved',input_text:'Offer',prompts:[{prompt:'saved text'}],created_at:'today'}];},quota:{status:async(scope)=>scope==='campaign'?quota:available}},async({base})=>{
    const res=await fetch(`${base}/access`);assert.equal(res.headers.get('cache-control'),'no-store');
    const data=await res.json();assert.equal(data.campaign.remaining,0);assert.equal(data.research.remaining,1);assert.equal(data.lastSession.id,'saved');
  });
});
test('IP keys canonicalize addresses and ignore spoofed first forwarding entries',()=>{
  assert.equal(normalizeAdIp('::ffff:192.0.2.1'),'192.0.2.1');assert.equal(normalizeAdIp('2001:0DB8:0:0::1'),'2001:db8::1');
  const req=(forwarded,id='u')=>({header:()=>forwarded,socket:{remoteAddress:'127.0.0.1'},authUser:{id}});
  assert.deepEqual(adQuotaSubjects(req('198.51.100.9, 192.0.2.1')),adQuotaSubjects(req('192.0.2.1')));
  assert.equal(adQuotaSubjects(req('192.0.2.1')).filter(key=>adQuotaSubjects(req('192.0.2.1','v')).includes(key)).length,1);
  assert.equal(adQuotaSubjects(req('192.0.2.1')).filter(key=>adQuotaSubjects(req('192.0.2.2')).includes(key)).length,1);
  assert.throws(()=>normalizeAdIp('garbage'));
});
test('percentage and amount coupons never exceed 20 percent',()=>{
  for(const amount of [1,101,2500,4900,9900,19900]){
    assert.equal(cappedCouponDiscount(amount,85),Math.floor(amount*.2));
    assert.equal(cappedCouponDiscount(amount,null,999999),Math.floor(amount*.2));
    assert(cappedCouponDiscount(amount,10)<=amount*.2);
  }
});
test('cost counts cached input and writes without double billing reasoning',()=>{
  assert.equal(estimateAdCost('gpt-5.6-sol',{inputTokens:1000,cachedInputTokens:400,cacheWriteTokens:100,outputTokens:200,reasoningTokens:150}),.00666);
  assert.equal(estimateAdCost('unknown',{inputTokens:1,outputTokens:1,reasoningTokens:0}),null);
});
test('metering isolates parallel calls, logs unknown usage and failures, fails closed before API',async()=>{
  const starts=[],finishes=[];let count=0;
  const log={start:async call=>{starts.push(call);},finish:async(call,status,usage)=>{finishes.push({call,status,usage});}};
  const client=createMeteredAdClient('fake','user','campaign',log,(_key,onUsage)=>async()=>{const n=++count;if(n===1)onUsage({inputTokens:10,outputTokens:5,reasoningTokens:2});if(n===3)throw Error('bad JSON');return{n};});
  await Promise.allSettled([client({model:'gpt-5.6-luna'}),client({}),client({})]);
  assert.equal(new Set(starts.map(c=>c.id)).size,3);assert.equal(finishes.filter(c=>c.usage===null).length,2);assert.equal(finishes.filter(c=>c.status==='failed').length,1);
  let called=false;await assert.rejects(createMeteredAdClient('fake','u','research',{start:async()=>{throw Error('DB down');},finish:async()=>{}},()=>async()=>{called=true;})({}));assert.equal(called,false);
});
