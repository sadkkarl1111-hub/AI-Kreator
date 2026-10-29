import { adQuotaDate, type AdQuota } from '@/lib/adQuota';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { vpsFetch } from '@/lib/vpsApi';
import { metaLibrarySearchUrl, type AdCampaignGoal, type AdResearchExample, type AdResearchReport } from '@/lib/adStudio';

export function AdCompetitorResearch({ description, goal, value, onChange, disabled, quota, onQuotaRefresh }: { description: string; goal: AdCampaignGoal; value: AdResearchExample[]; onChange: (items: AdResearchExample[]) => void; disabled: boolean; quota?: AdQuota; onQuotaRefresh?: () => Promise<void> }) {
  const [query,setQuery]=useState(''),[country,setCountry]=useState('PL'),[pageId,setPageId]=useState('');
  const [configured,setConfigured]=useState<boolean|null>(null),[statusError,setStatusError]=useState('');
  const [ads,setAds]=useState<AdResearchExample[]>([]),[searched,setSearched]=useState(false),[limited,setLimited]=useState(false);
  const [copy,setCopy]=useState(''),[pageName,setPageName]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState<'search'|'analyze'|null>(null);
  const [report,setReport]=useState<{ key: string; data: AdResearchReport }|null>(null);
  const job=useRef<AbortController|null>(null);
  const reportKey=JSON.stringify({description,goal,value});
  const loadStatus=async()=>{setStatusError('');try{const data=await vpsFetch<{configured:boolean}>('/ad-generator/library/status',undefined,{retryAuthOnly:true});setConfigured(data.configured===true);}catch{setStatusError('Nie udało się sprawdzić połączenia Meta. Wklej tekst reklamy lub odśwież dostęp.');}};
  useEffect(()=>{let active=true;const controller=new AbortController();void vpsFetch<{configured:boolean}>('/ad-generator/library/status',{signal:controller.signal},{retryAuthOnly:true}).then(data=>{if(active)setConfigured(data.configured===true);}).catch(()=>{if(active)setStatusError('Nie udało się sprawdzić połączenia Meta. Wklej tekst reklamy lub odśwież dostęp.');});return()=>{active=false;controller.abort();job.current?.abort();};},[]);
  const run=async(kind:'search'|'analyze')=>{
    if(job.current||disabled||(kind==='analyze'&&quota?.remaining===0))return;const controller=new AbortController();job.current=controller;setBusy(kind);setError('');
    const key=reportKey;
    try{
      if(kind==='search'){
        const data=await vpsFetch<{ads:AdResearchExample[];limited?:boolean}>('/ad-generator/library/search',{method:'POST',signal:controller.signal,body:JSON.stringify({query,country,pageId})},{retryAuthOnly:true});
        if(!controller.signal.aborted){setAds(data.ads||[]);setSearched(true);setLimited(Boolean(data.limited));}
      }else{
        const data=await vpsFetch<{report:AdResearchReport}>('/ad-generator/library/analyze',{method:'POST',signal:controller.signal,body:JSON.stringify({text:description,goal,competitorExamples:value})},{retryAuthOnly:true});
        if(!controller.signal.aborted)setReport({key,data:data.report});
      }
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Nie udało się przygotować badania.');}
    finally{if(job.current===controller){job.current=null;setBusy(null);if(kind==='analyze')void onQuotaRefresh?.();}}
  };
  const add=(item:AdResearchExample)=>{if(disabled||value.length>=6||value.some(row=>row.id===item.id))return;onChange([...value,item]);};
  const visibleReport=report?.key===reportKey?report.data:null;
  return <details className="mt-5 rounded-xl border bg-muted/20 p-4"><summary className="cursor-pointer text-sm font-semibold">Konkurencja i plan testów · opcjonalnie ({value.length}/6)</summary><div className="mt-4 space-y-4">
    <p className="text-sm text-muted-foreground">Wpisz dowolną branżę, rodzaj oferty lub firmę. Wybierz przykłady, aby szukać innego kąta komunikacji dla własnej marki. Analiza dotyczy tekstów reklam.</p>
    <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">Biblioteka nie pokazuje sprzedaży, kosztu pozyskania ani ROAS konkurencji. Długa emisja nie dowodzi skuteczności. Poniższe wnioski są inspiracjami i hipotezami do testów.</p>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]"><label className="space-y-1 text-sm">Branża lub firma<input aria-label="Branża lub firma" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Np. świece sojowe, szkolenia, usługi księgowe" className="h-11 w-full rounded-md border bg-background px-3"/></label><label className="space-y-1 text-sm">Rynek<select aria-label="Rynek reklam" value={country} onChange={e=>setCountry(e.target.value)} className="h-11 w-full rounded-md border bg-background px-2">{[['PL','Polska'],['DE','Niemcy'],['CZ','Czechy'],['SK','Słowacja'],['FR','Francja'],['ES','Hiszpania'],['IT','Włochy'],['NL','Holandia'],['GB','W. Brytania']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
    <details><summary className="cursor-pointer text-xs text-muted-foreground">Szukaj konkretnej strony po ID</summary><input aria-label="ID strony konkurenta" inputMode="numeric" value={pageId} maxLength={30} onChange={e=>setPageId(e.target.value)} placeholder="Numeryczne ID strony na Facebooku" className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"/></details>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="gap-2" disabled={disabled||Boolean(busy)||!configured||(!pageId&&query.trim().length<2)} onClick={()=>void run('search')}><Search className="h-4 w-4"/>{busy==='search'?'Szukam…':'Wyszukaj w Meta'}</Button><Button type="button" variant="outline" asChild><a href={metaLibrarySearchUrl(query,country)} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Otwórz Bibliotekę Meta</a></Button></div>
    {configured===false&&<p role="status" className="text-xs text-muted-foreground">Automatyczne pobieranie reklam Meta czeka na podłączenie przez administratora. Teraz otwórz bibliotekę i wklej tekst wybranej reklamy poniżej.</p>}
    {statusError&&<p className="text-xs text-muted-foreground">{statusError}</p>}
    {(statusError||configured===false)&&<Button type="button" variant="ghost" size="sm" onClick={()=>void loadStatus()}>Odśwież połączenie Meta</Button>}
    {searched&&!ads.length&&<p role="status" className="text-sm">Brak reklam z tekstem w tej próbce. Zmień frazę lub rynek.</p>}
    {limited&&<p className="text-xs text-muted-foreground">Pokazujemy pierwszą próbkę do 20 reklam, a nie cały rynek. Zawęź frazę lub ID strony.</p>}
    {!!ads.length&&<div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">{ads.map(item=><article key={item.id} className="space-y-2 rounded-lg border bg-background p-3"><h4 className="text-sm font-semibold">{item.pageName}</h4><p className="whitespace-pre-wrap break-words text-xs">{item.text}</p><p className="text-[11px] text-muted-foreground">{item.startDate?`Emisja od ${item.startDate}`:'Brak daty'} · {(item.platforms||[]).join(', ')}</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={disabled||value.length>=6||value.some(row=>row.id===item.id)} onClick={()=>add(item)}>Dodaj inspirację</Button><a href={/^https:\/\/www\.facebook\.com\/ads\/library\/\?id=\d+$/.test(item.url||'')?item.url:metaLibrarySearchUrl(item.pageName,country)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-xs text-primary underline">Zobacz reklamę</a></div></article>)}</div>}
    <div className="space-y-2 rounded-lg border bg-background p-3"><h4 className="text-sm font-semibold">Dodaj tekst reklamy jako inspirację</h4><input aria-label="Nazwa źródła inspiracji" maxLength={120} value={pageName} onChange={e=>setPageName(e.target.value)} placeholder="Nazwa firmy / źródła (opcjonalnie)" className="h-10 w-full rounded-md border bg-background px-3 text-sm"/><Textarea aria-label="Tekst reklamy konkurencji" value={copy} maxLength={2000} onChange={e=>setCopy(e.target.value)} rows={3} placeholder="Wklej treść lub nagłówek reklamy. Nie podawaj jej jako faktów o swojej firmie."/><Button type="button" size="sm" variant="outline" className="gap-2" disabled={disabled||value.length>=6||!copy.trim()} onClick={()=>{add({id:`manual-${crypto.randomUUID()}`,pageName:pageName.trim()||'Wklejona inspiracja',text:copy.trim(),source:'manual'});setCopy('');setPageName('');}}><Plus className="h-4 w-4"/>Dodaj do inspiracji</Button></div>
    {!!value.length&&<div className="space-y-2"><p className="text-xs font-semibold">Wybrane inspiracje — zostaną użyte przy przygotowaniu propozycji</p>{value.map(item=><div key={item.id} className="flex min-w-0 items-start gap-2 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{item.pageName} · {item.source==='meta'?'Biblioteka Meta':'tekst użytkownika'}</p><p className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground">{item.text}</p></div><Button type="button" size="icon" variant="ghost" disabled={disabled||Boolean(busy)} aria-label={`Usuń inspirację: ${item.pageName}`} onClick={()=>onChange(value.filter(row=>row.id!==item.id))}><Trash2 className="h-4 w-4"/></Button></div>)}</div>}
    <p role="status" className="text-xs text-muted-foreground">Bezpłatna analiza: 1 rozpoczęcie co 7 dni na IP i konto, niezależnie od zestawu promptów. {quota?.remaining===0?`Kolejna analiza: ${adQuotaDate(quota)}.`:'Możesz teraz przygotować analizę.'}</p>
    <Button type="button" className="gap-2" disabled={disabled||Boolean(busy)||quota?.remaining===0||!value.length||!description.trim()} onClick={()=>void run('analyze')}>{busy==='analyze'&&<Loader2 className="h-4 w-4 animate-spin"/>}Przeanalizuj inspiracje i zaproponuj testy</Button>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {visibleReport&&<section aria-label="Plan testów reklam" className="space-y-3"><h4 className="font-semibold">Co warto przetestować</h4>{visibleReport.observations.map((row,i)=><div key={i} className="rounded-lg border p-3 text-sm"><p>{row.observation}</p><p className="mt-1 text-xs text-muted-foreground">Źródła: {row.evidenceIds.map(id=>value.find(item=>item.id===id)?.pageName||id).join(', ')}</p></div>)}{visibleReport.tests.map((row,i)=><div key={i} className="space-y-2 rounded-lg border bg-primary/5 p-3 text-sm"><p className="font-semibold">Hipoteza {i+1}: {row.hypothesis}</p><p><strong>A:</strong> {row.variantA}</p><p><strong>B:</strong> {row.variantB}</p><p className="text-xs text-muted-foreground">Mierz: {row.metric}. Porównaj warianty przy podobnym budżecie i tej samej grupie odbiorców.</p></div>)}</section>}
  </div></details>;
}
