import { createMeteredAdClient } from '../lib/adUsage.js';
import { adWeeklyStore, adQuotaSubjects } from '../lib/adWeeklyAccess.js';
import { adQuotaBlocked } from '../lib/adQuotaResponse.js';
import { Router, type RequestHandler, type Request } from 'express';
import { env } from '../config/env.js';
import { requireAuthenticatedUser } from '../middleware/requireAuthenticatedUser.js';
import { requireAdGeneratorAccess } from '../middleware/requireAdGeneratorAccess.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { AdProviderError } from '../lib/adCreativeAi.js';
import { readCampaignOptions, researchAdExamples, type AdResearchReport, type AdCampaignOptions } from '../lib/adResearch.js';
import { metaLibraryConfigured, MetaLibraryError, readMetaSearch, searchMetaAds } from '../lib/metaAdLibrary.js';

const token = () => process.env.META_AD_LIBRARY_ACCESS_TOKEN?.trim() || '';
const version = () => process.env.META_GRAPH_API_VERSION?.trim() || '';
type Dependencies = {
  authenticate: RequestHandler; authorize: RequestHandler;
  quota: typeof adWeeklyStore; subjects: (req: Request) => string[]; apiAvailable: () => boolean;
  configured: () => boolean;
  search: (input: ReturnType<typeof readMetaSearch>, signal: AbortSignal) => ReturnType<typeof searchMetaAds>;
  research: (description: string, options: AdCampaignOptions, signal: AbortSignal, userId: string) => Promise<AdResearchReport>;
};
export function createAdResearchRouter(overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    authenticate: requireAuthenticatedUser, authorize: requireAdGeneratorAccess,
    quota: adWeeklyStore, subjects: adQuotaSubjects, apiAvailable: () => Boolean(env.openAiApiKey),
    configured: () => metaLibraryConfigured(token(),version()),
    search: (input,signal) => searchMetaAds(input,token(),version(),signal),
    research: (description,options,signal,userId) => researchAdExamples(createMeteredAdClient(env.openAiApiKey,userId,'research'),description,options,signal),
    ...overrides,
  };
  const router=Router();
  const rate = createRateLimitMiddleware({ scope: 'ad-research', max: 20, windowMs: 15*60*1000, message: 'Zbyt wiele analiz. Spróbuj ponownie za kilka minut.', keyResolver: req => [req.authUser!.id] });
  router.use('/ad-generator/library',deps.authenticate,deps.authorize);
  router.get('/ad-generator/library/status',(_req,res)=>res.set('Cache-Control','no-store').json({ configured: deps.configured(), supported: 'EU_UK', salesResultsAvailable: false }));
  router.post('/ad-generator/library/search',rate,async(req,res)=>{
    const controller=new AbortController(); const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try {
      let input; try {input=readMetaSearch(req.body||{});} catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Sprawdź wyszukiwanie.'});}
      if(!deps.configured())return res.status(503).json({error:'Automatyczne wyszukiwanie Meta nie jest jeszcze podłączone. Otwórz Bibliotekę Meta i wklej tekst wybranej reklamy.'});
      return res.set('Cache-Control','no-store').json({ok:true,...await deps.search(input,controller.signal)});
    }catch(error){if(!res.destroyed)return res.status(error instanceof MetaLibraryError?error.status:502).json({error:error instanceof MetaLibraryError?error.message:'Nie udało się odczytać Biblioteki Meta. Spróbuj ponownie.'});}
    finally{res.off('close',close);}
  });
  router.post('/ad-generator/library/analyze',rate,async(req,res)=>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try {
      let options; const description=typeof req.body?.text==='string'?req.body.text.trim():'';
      try{options=readCampaignOptions(req.body||{});if(!description||description.length>12000||!options.competitorExamples?.length)throw new Error('Opisz swoją ofertę i dodaj do 6 inspiracji.');}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Sprawdź materiały.'});}
      if(!deps.apiAvailable())return res.status(503).json({error:'Generator AI jest chwilowo niedostępny.'});
      const quota=await deps.quota.consume('research',deps.subjects(req));
      if(!quota.claimed)return adQuotaBlocked(res,quota);
      return res.set('Cache-Control','no-store').json({ok:true,quota,creditsUsed:0,report:await deps.research(description,options,controller.signal,req.authUser!.id)});
    }catch(error){if(!res.destroyed)return res.status(502).json({error:error instanceof AdProviderError&&error.code==='insufficient_quota'?'Limit rozliczeniowy AI został wyczerpany. Administrator musi sprawdzić saldo API.':'Nie udało się przygotować analizy. Materiały zostały zachowane. Sprawdź datę kolejnej bezpłatnej analizy.'});}
    finally{clearTimeout(timer);res.off('close',close);}
  });
  return router;
}
