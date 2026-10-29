import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiModels } from '@/hooks/useAiModels';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { getStoredAuthSession } from '@/lib/authSession';
import { readLocalDesignImage, saveLocalBlob } from '@/lib/localDesignExport';
import { vpsFetch } from '@/lib/vpsApi';
import type { AdPromptResult } from '@/pages/AdPromptGenerator';

const VARIANTS = {
  concept: 'Follow the supplied art direction and composition. Keep all approved visible text unchanged.',
  closeup: 'Create a distinct test variation: tighter close-up of the main subject, stronger foreground detail, quiet copy area on the opposite side. Preserve the assigned visual style, setting, original offer, exact approved visible text, reference identity and high contrast.',
  depth: 'Create a distinct test variation: wider perspective, three clear depth planes, different subject placement and camera angle within the assigned setting. Preserve the original offer, exact approved visible text, assigned style, reference identity and high contrast. Do not invent claims or visible text.',
};
export function AdStudioImageGenerator(props: { ad: AdPromptResult; index: number; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const [open,setOpen]=useState(false);
  const {user}=useAuth();
  return <div className="space-y-3"><Button type="button" variant="outline" className="h-auto min-h-11 w-full gap-2 whitespace-normal" disabled={props.disabled} onClick={()=>setOpen(true)}><ImagePlus className="h-4 w-4"/>{open?'Ustawienia i wygenerowane grafiki':'Wygeneruj grafikę tutaj'}</Button>{open&&<ImagePanel key={user?.id||'guest'} {...props}/>}</div>;
}
function ImagePanel({ ad,index,disabled,onBusyChange }: { ad: AdPromptResult; index: number; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const { aiModels,selectedModel,selectedModelOption:model,setSelectedModel,loading:modelsLoading }=useAiModels({purpose:'generation'});
  const credits=useCredits();
  const [dimensions,setDimensions]=useState('1024x1024'),[variant,setVariant]=useState<keyof typeof VARIANTS>('concept');
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[phase,setPhase]=useState(''),[error,setError]=useState('');
  const [results,setResults]=useState<{url:string;variant:string;owner:string}[]>([]),[downloading,setDownloading]=useState(false);
  const job=useRef<AbortController|null>(null),uploaded=useRef<{file:File;owner:string;path:string}|null>(null);
  const {user}=useAuth();const owner=user?.id;
  const visibleResults=results.filter(item=>item.owner===owner);
  useEffect(()=>()=>{if(job.current){job.current.abort();job.current=null;onBusyChange(false);}},[onBusyChange,owner]);
  const insufficient=!credits.isAdmin&&model&&credits.balance!==null&&credits.balance<model.cost;
  const submit=async()=>{
    if(job.current||disabled||!model||!owner||insufficient||credits.loading||visibleResults.length>=3||ad.needsImage&&(!file||!model.supportsReferenceImages))return;
    const controller=new AbortController();job.current=controller;setBusy(true);onBusyChange(true);setError('');
    const current=()=>!controller.signal.aborted&&job.current===controller&&getStoredAuthSession()?.user?.id===owner;
    try{
      const paths:string[]=[];
      if(ad.needsImage&&file){
        setPhase('Przygotowuję zdjęcie referencyjne…');
        if(!uploaded.current||uploaded.current.file!==file||uploaded.current.owner!==owner){
          const image=await readLocalDesignImage(file,1600);if(!current())return;
          const upload=await vpsFetch<{path?:string}>('/gallery/reference-upload',{method:'POST',signal:controller.signal,body:JSON.stringify({dataUrl:image.dataUrl,fileName:file.name})},{retryAuthOnly:true});
          if(!upload.path)throw new Error('Nie udało się przesłać zdjęcia.');if(!current())return;uploaded.current={file,owner,path:upload.path};
        }
        paths.push(uploaded.current.path);
      }
      setPhase('Generuję grafikę reklamową…');
      const data=await vpsFetch<{imageUrl?:string}>('/ai/generate-image',{method:'POST',signal:controller.signal,body:JSON.stringify({prompt:ad.prompt+'\nTEST VARIATION (drawing instructions only): '+VARIANTS[variant],model:selectedModel,expectedCreditCost:model.cost,dimensions,style:ad.styleId==='collage'?'illustration':'realistic',count:1,referenceImagePaths:paths})},{retryAuthOnly:true});
      if(!current())return;if(!data.imageUrl)throw new Error('Brak obrazu w odpowiedzi. Sprawdź galerię przed kolejną próbą.');
      setResults(previous=>[...previous,{url:data.imageUrl!,variant,owner}]);
    }catch(reason){if(current())setError(reason instanceof Error?reason.message:'Nie udało się wygenerować obrazu. Sprawdź galerię przed ponowną próbą.');}
    finally{if(job.current===controller){job.current=null;setBusy(false);onBusyChange(false);void credits.refetch();}}
  };
  const download=async(url:string,number:number)=>{setDownloading(true);setError('');try{const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('Nie udało się pobrać pliku. Otwórz wynik w galerii.');const blob=await response.blob();saveLocalBlob(blob,`reklama-${index+1}-wariant-${number}.png`);}catch(reason){setError(reason instanceof Error?reason.message:'Błąd pobierania.');}finally{setDownloading(false);}};
  return <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
    <fieldset disabled={busy||disabled} className="min-w-0 space-y-3">
      <label className="block space-y-1 text-xs">Model grafiki<select aria-label={`Model grafiki ${index+1}`} value={selectedModel} onChange={e=>setSelectedModel(e.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-background px-2 text-sm">{aiModels.map(item=><option key={item.id} value={item.id}>{item.label} · {item.cost} kredytów</option>)}</select></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="block space-y-1 text-xs">Format<select aria-label={`Format grafiki ${index+1}`} value={dimensions} onChange={e=>setDimensions(e.target.value)} className="h-11 w-full rounded-md border bg-background px-2 text-sm"><option value="1024x1024">Kwadrat 1:1</option><option value="1080x1350">Pion 4:5</option><option value="1080x1920">Stories 9:16</option><option value="1536x1024">Poziomo 3:2</option></select></label><label className="block space-y-1 text-xs">Kompozycja<select aria-label={`Kompozycja grafiki ${index+1}`} value={variant} onChange={e=>setVariant(e.target.value as keyof typeof VARIANTS)} className="h-11 w-full rounded-md border bg-background px-2 text-sm"><option value="concept">A · zgodna z pomysłem</option><option value="closeup">B · mocne zbliżenie</option><option value="depth">C · głębia i perspektywa</option></select></label></div>
      {ad.needsImage&&<label className="block space-y-2 text-xs">Twoje zdjęcie osoby lub produktu<input aria-label={`Zdjęcie referencyjne ${index+1}`} type="file" accept="image/png,image/jpeg,image/webp" className="block w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:p-2" onChange={e=>{setFile(e.target.files?.[0]||null);uploaded.current=null;}}/><span className="block text-muted-foreground">Wybierz własne zdjęcie, które ma zostać zachowane. Materiały konkurencji nie są używane jako referencja osoby lub produktu. PNG/JPG/WebP, do 12 MB.</span></label>}
    </fieldset>
    {ad.needsImage&&model&&!model.supportsReferenceImages&&<p className="text-xs text-destructive">Ten model nie obsługuje zdjęcia referencyjnego. Wybierz inny model.</p>}
    {insufficient&&<p className="text-xs text-destructive">Brakuje kredytów na ten model. <Link to="/credits" className="underline">Doładuj saldo</Link>.</p>}
    <Button type="button" className="h-auto min-h-11 w-full gap-2 whitespace-normal" onClick={()=>void submit()} disabled={disabled||busy||modelsLoading||!model||credits.loading||Boolean(insufficient)||!owner||visibleResults.length>=3||ad.needsImage&&(!file||!model.supportsReferenceImages)}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<ImagePlus className="h-4 w-4"/>}{busy?phase:credits.isAdmin?'Generuj 1 grafikę · administrator':`Generuj 1 grafikę · ${model?.cost??'—'} kredytów`}</Button>
    <p className="text-[11px] text-muted-foreground">{credits.isAdmin?'Administrator: bez potrącania kredytów.':'Koszt dotyczy jednej grafiki.'} Do 3 wyników na pomysł w tej sesji. Wyniki zapisują się w galerii. Zamknięcie strony nie zatrzymuje pracy AI; po błędzie połączenia sprawdź galerię przed ponowną próbą.</p>
    {!modelsLoading&&!aiModels.length&&<p role="status" className="text-xs">Brak dostępnych modeli grafiki. Odśwież stronę.</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {!!visibleResults.length&&<div className="grid gap-3">{visibleResults.map((item,i)=><div key={i} className="space-y-2"><img src={item.url} alt={`Gotowa reklama ${index+1}, wariant ${i+1}`} className="max-h-96 w-full rounded-lg border object-contain"/><Button type="button" variant="outline" size="sm" className="w-full gap-2" disabled={downloading} onClick={()=>void download(item.url,i+1)}><Download className="h-4 w-4"/>Pobierz wariant {i+1}</Button></div>)}<Button variant="link" asChild><Link to="/gallery">Otwórz galerię grafik</Link></Button></div>}
  </div>;
}
