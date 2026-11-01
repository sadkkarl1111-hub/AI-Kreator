import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarClock, Code2, Copy, Download, Gauge, Monitor, Plus, RotateCcw, Smartphone, Trash2, Users } from 'lucide-react';
import { LocalSvgTool } from '@/components/LocalSvgTool';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { compileWidget, defaultWidgetSettings, widgetDocument, widgetEmbedCode, WIDGET_THEMES, WIDGET_ZONES, zonedInput, type WidgetKind, type WidgetSettings, type WidgetSource, type WidgetTheme } from '@/lib/embedWidgets';

const selectClass = 'h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm';
function Field({ name, children, hint }: { name: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-sm font-medium">{name}</span>{children}{hint && <span className="block text-xs leading-5 text-muted-foreground">{hint}</span>}</label>;
}
const kinds = [{ id:'countdown' as const, label:'Do wydarzenia', icon:CalendarClock },{ id:'seats' as const, label:'Wolne miejsca', icon:Users },{ id:'progress' as const, label:'Pasek postępu', icon:Gauge }];

export default function EmbedWidgets() {
  const [settings,setSettings] = useState<WidgetSettings>(()=>defaultWidgetSettings());
  const [mobile,setMobile] = useState(false);
  const [height,setHeight] = useState(340);
  const [notice,setNotice] = useState('');
  const [endpointDraft,setEndpointDraft] = useState('');
  const frame=useRef<HTMLIFrameElement>(null),codeArea=useRef<HTMLTextAreaElement>(null),codeDetails=useRef<HTMLDetailsElement>(null);
  const result=useMemo(()=>compileWidget(settings),[settings]);
  const code=useMemo(()=>widgetEmbedCode(settings),[settings]);
  const document=useMemo(()=>result.errors.length?'':widgetDocument(settings,true),[settings,result.errors.length]);
  const timed=settings.kind==='countdown'||(settings.kind==='progress'&&settings.progressMode==='time');
  const patch=(values:Partial<WidgetSettings>)=>{setSettings(current=>({...current,...values}));setNotice('');};
  useEffect(()=>{
    const resize=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.data?.type!=='ak-widget-size'||!Number.isFinite(event.data.height))return;
      setHeight(Math.min(1200,Math.max(120,event.data.height+2)));
    };
    window.addEventListener('message',resize);return()=>window.removeEventListener('message',resize);
  },[]);
  function chooseKind(kind:WidgetKind){
    const titles={countdown:'Widzimy się na webinarze!',seats:'Zarezerwuj swoje miejsce',progress:'Jesteśmy coraz bliżej celu'};
    const subtitles={countdown:'Zarezerwuj chwilę dla siebie. Zaczynamy za…',seats:'Dołącz do kolejnej edycji.',progress:'Zobacz, jak posuwamy się naprzód.'};
    const finishText={countdown:'Wydarzenie już się rozpoczęło!',seats:'Wszystkie miejsca są już zajęte.',progress:'Cel osiągnięty!'};
    patch({kind,title:titles[kind],subtitle:subtitles[kind],finishText:finishText[kind]});
  }
  async function copy(){
    try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(code);setNotice('Kod skopiowany. Wklej go do bloku HTML na swojej stronie.');}
    catch{if(codeDetails.current)codeDetails.current.open=true;codeArea.current?.focus();codeArea.current?.select();setNotice('Schowek jest niedostępny. Kod został zaznaczony — skopiuj go ręcznie.');}
  }
  function download(){
    const url=URL.createObjectURL(new Blob([widgetDocument(settings)],{type:'text/html;charset=utf-8'}));
    const anchor=window.document.createElement('a');anchor.href=url;anchor.download=`widzet-${settings.kind}.html`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('Plik HTML pobrany. Możesz otworzyć go w przeglądarce lub umieścić na swoim hostingu.');
  }
  function chooseSource(source:WidgetSource){patch({source,...(source==='steps'&&!settings.steps.length?{steps:[{date:zonedInput(Date.now()+86400000,settings.zone),value:Math.max(0,settings.value-2)}]}:{})});}

  return <LocalSvgTool title="Liczniki i paski na Twoją stronę" description="Ustaw termin, liczbę miejsc lub postęp. Dodaj własny harmonogram i skopiuj gotowy kod HTML. Bez logowania i kredytów.">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Rodzaj widżetu">{kinds.map(({id,label,icon:Icon})=><Button key={id} className="min-h-12 justify-start gap-2" variant={settings.kind===id?'default':'outline'} aria-pressed={settings.kind===id} onClick={()=>chooseKind(id)}><Icon className="h-5 w-5"/>{label}</Button>)}</div>

    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(300px,.85fr)_minmax(0,1.15fr)] lg:items-start">
      <div className="min-w-0 space-y-5">
        <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="widget-content">
          <h2 id="widget-content" className="text-lg font-semibold">Treść i wartości</h2>
          <Field name="Tytuł"><Input aria-label="Tytuł widżetu" className="h-11" maxLength={100} value={settings.title} onChange={event=>patch({title:event.target.value})}/></Field>
          <Field name="Opis"><Input aria-label="Opis widżetu" className="h-11" maxLength={240} value={settings.subtitle} onChange={event=>patch({subtitle:event.target.value})}/></Field>
          <Field name="Strefa czasu"><select aria-label="Strefa czasu" className={selectClass} value={settings.zone} onChange={event=>patch({zone:event.target.value})}>{WIDGET_ZONES.map(zone=><option key={zone}>{zone}</option>)}</select></Field>
          {settings.kind==='progress'&&<Field name="Sposób obliczania postępu"><select aria-label="Sposób obliczania postępu" className={selectClass} value={settings.progressMode} onChange={event=>patch({progressMode:event.target.value as 'value'|'time'})}><option value="value">Na podstawie wartości</option><option value="time">Automatycznie od daty do daty</option></select></Field>}
          {timed?<>
            {settings.kind==='progress'&&<Field name="Początek"><Input aria-label="Początek postępu" type="datetime-local" className="h-11 min-w-0" value={settings.start} onChange={event=>patch({start:event.target.value})}/></Field>}
            <Field name={settings.kind==='countdown'?'Data i godzina wydarzenia':'Koniec'} hint="Każdy odwiedzający odlicza do tego samego momentu w wybranej strefie."><Input aria-label="Data i godzina końca" type="datetime-local" className="h-11 min-w-0" value={settings.deadline} onChange={event=>patch({deadline:event.target.value})}/></Field>
          </>:<>
            <div className="grid grid-cols-2 gap-3"><Field name={settings.kind==='seats'?'Wszystkich miejsc':'Cel (maksimum)'}><Input aria-label="Łączna liczba" className="h-11" type="number" min={1} max={1000000} value={settings.total} onChange={event=>patch({total:Number(event.target.value)})}/></Field><Field name={settings.kind==='seats'?'Wolnych na początku':'Wartość początkowa'}><Input aria-label="Wartość początkowa" className="h-11" type="number" min={0} max={settings.total} value={settings.value} onChange={event=>patch({value:Number(event.target.value)})}/></Field></div>
            <Field name="Jak zmienia się wartość?"><select aria-label="Źródło wartości" className={selectClass} value={settings.source} onChange={event=>chooseSource(event.target.value as WidgetSource)}><option value="manual">Wpisuję ręcznie</option><option value="daily">Codziennie o ustalonej godzinie</option><option value="steps">Według konkretnych dat</option><option value="url">Z własnego adresu danych JSON</option></select></Field>
            {settings.source==='manual'&&<p className="text-xs leading-5 text-muted-foreground">Wartość pozostaje taka, jak ją ustawisz. Po zmianie wklej nowy kod na swoją stronę.</p>}
            {settings.source==='daily'&&<div className="space-y-3 rounded-lg bg-muted/50 p-3">
              <Field name="Początek harmonogramu" hint="Ta godzina wyznacza także porę kolejnych zmian. Pierwsza zmiana nastąpi następnego dnia."><Input aria-label="Początek harmonogramu" className="h-11 min-w-0" type="datetime-local" value={settings.start} onChange={event=>patch({start:event.target.value})}/></Field>
              <Field name="Zmiana każdego dnia" hint="Np. −2 odejmuje 2 dziennie, a 5 dodaje 5. Wynik zatrzyma się na 0 lub maksimum."><Input aria-label="Zmiana każdego dnia" className="h-11" type="number" value={settings.delta} onChange={event=>patch({delta:Number(event.target.value)})}/></Field>
              <p className="text-xs leading-5 text-muted-foreground">To planowana zmiana wartości. Harmonogram nie odczytuje rzeczywistych zapisów ani zakupów.</p>
            </div>}
            {settings.source==='steps'&&<div className="space-y-3 rounded-lg bg-muted/50 p-3">
              <p className="text-xs leading-5 text-muted-foreground">Przed pierwszą datą widoczna jest wartość początkowa. Każdy etap ustawia podaną liczbę.</p>
              {settings.steps.map((step,index)=><div key={index} className="space-y-2 rounded-lg border bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Etap {index+1}</span><Button variant="ghost" size="icon" aria-label={`Usuń etap ${index+1}`} onClick={()=>patch({steps:settings.steps.filter((_,i)=>i!==index)})}><Trash2 className="h-4 w-4"/></Button></div><Input aria-label={`Data etapu ${index+1}`} className="h-11 min-w-0" type="datetime-local" value={step.date} onChange={event=>patch({steps:settings.steps.map((s,i)=>i===index?{...s,date:event.target.value}:s)})}/><Input aria-label={`Wartość etapu ${index+1}`} className="h-11" type="number" value={step.value} onChange={event=>patch({steps:settings.steps.map((s,i)=>i===index?{...s,value:Number(event.target.value)}:s)})}/></div>)}
              <Button className="min-h-11 w-full gap-2" variant="outline" disabled={settings.steps.length>=30} onClick={()=>patch({steps:[...settings.steps,{date:zonedInput(Date.now()+(settings.steps.length+1)*86400000,settings.zone),value:Math.max(0,settings.value-(settings.steps.length+1)*2)}]})}><Plus className="h-4 w-4"/>Dodaj termin zmiany</Button>
            </div>}
            {settings.source==='url'&&<div className="space-y-3 rounded-lg bg-muted/50 p-3"><Field name="Publiczny adres HTTPS do danych" hint="Bez haseł i prywatnych kluczy. Serwer musi pozwalać na odczyt CORS z docelowej strony; podgląd wymaga zgody na odczyt z dowolnej domeny."><Input aria-label="Adres danych JSON" className="h-11" placeholder="https://twoja-strona.pl/licznik.json" value={endpointDraft} onChange={event=>setEndpointDraft(event.target.value)}/></Field><Button className="min-h-11 w-full" variant="outline" onClick={()=>patch({endpoint:endpointDraft})}>Użyj adresu danych</Button><p className="text-xs text-muted-foreground">Odczyt co minutę. Wymagany format:</p><code className="block overflow-auto rounded border bg-card p-2 text-xs">{settings.kind==='seats'?'{"total": 100, "remaining": 23}':'{"total": 100, "current": 62}'}</code><p className="text-xs leading-5 text-muted-foreground">Po błędzie pozostaje ostatni poprawny odczyt z informacją o braku odświeżenia. Kod nie tworzy systemu zapisów.</p></div>}
          </>}
          {result.ambiguous&&<Field name="Powtórzona godzina przy zmianie czasu"><select aria-label="Powtórzona godzina" className={selectClass} value={settings.occurrence} onChange={event=>patch({occurrence:event.target.value as 'earlier'|'later'})}><option value="earlier">Pierwsze wystąpienie godziny</option><option value="later">Drugie wystąpienie godziny</option></select></Field>}
          <Field name="Komunikat po zakończeniu"><Input aria-label="Komunikat po zakończeniu" className="h-11" maxLength={140} value={settings.finishText} onChange={event=>patch({finishText:event.target.value})}/></Field>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="widget-look"><h2 id="widget-look" className="text-lg font-semibold">Wygląd</h2>
          <div className="grid grid-cols-2 gap-2">{(Object.keys(WIDGET_THEMES) as WidgetTheme[]).map(theme=><Button key={theme} variant={settings.theme===theme?'default':'outline'} className="min-h-11" aria-pressed={settings.theme===theme} onClick={()=>{const {accent,background,foreground}=WIDGET_THEMES[theme];patch({theme,accent,background,foreground});}}>{WIDGET_THEMES[theme].label}</Button>)}</div>
          <div className="grid grid-cols-3 gap-3">{([['accent','Akcent'],['background','Tło'],['foreground','Tekst']] as const).map(([key,label])=><Field key={key} name={label}><input type="color" aria-label={`Kolor: ${label}`} className="h-11 w-full cursor-pointer rounded border bg-background p-1" value={settings[key]} onChange={event=>patch({[key]:event.target.value})}/></Field>)}</div>
          <Field name={`Zaokrąglenie: ${settings.radius} px`}><input type="range" aria-label="Zaokrąglenie" className="w-full accent-primary" min={0} max={40} value={settings.radius} onChange={event=>patch({radius:Number(event.target.value)})}/></Field>
          <div className="space-y-2 text-sm"><label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={settings.animated} onChange={event=>patch({animated:event.target.checked})}/>Animacja paska (z uwzględnieniem ograniczenia ruchu)</label><label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={settings.showDetails} onChange={event=>patch({showDetails:event.target.checked})}/>Pokaż szczegóły wartości lub terminu</label></div>
          <Button variant="ghost" className="min-h-11 gap-2" onClick={()=>{setSettings(defaultWidgetSettings());setEndpointDraft('');setNotice('');}}><RotateCcw className="h-4 w-4"/>Przywróć ustawienia początkowe</Button>
        </section>
      </div>

      <div className="min-w-0 space-y-5 lg:sticky lg:top-20">
        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="widget-preview"><div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h2 id="widget-preview" className="font-semibold">Tak będzie wyglądać na stronie</h2><div className="flex gap-1"><Button variant={mobile?'ghost':'secondary'} size="icon" aria-label="Podgląd na komputerze" aria-pressed={!mobile} onClick={()=>setMobile(false)}><Monitor className="h-4 w-4"/></Button><Button variant={mobile?'secondary':'ghost'} size="icon" aria-label="Podgląd na telefonie" aria-pressed={mobile} onClick={()=>setMobile(true)}><Smartphone className="h-4 w-4"/></Button></div></div>
          <div className="flex min-h-60 items-center justify-center bg-muted/35 px-0 py-4 sm:px-2">{result.errors.length?<div className="space-y-2 p-5 text-sm" role="alert"><p className="font-semibold">Uzupełnij ustawienia</p>{result.errors.map(error=><p key={error} className="text-destructive">{error}</p>)}</div>:<iframe ref={frame} title="Podgląd działającego widżetu" sandbox="allow-scripts" srcDoc={document} className="block border-0" style={{width:mobile?'min(100%, 360px)':'100%',height}}/>}</div>
          <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">Podgląd uruchamia ten sam kod, który skopiujesz. Wartości zależne od czasu liczą się według zegara urządzenia odwiedzającego.</p>
        </section>
        <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="widget-export"><h2 id="widget-export" className="flex items-center gap-2 text-lg font-semibold"><Code2 className="h-5 w-5 text-primary"/>Gotowy kod na Twoją stronę</h2>
          <div className="grid gap-2 sm:grid-cols-2"><Button disabled={!code} className="min-h-12 gap-2" onClick={()=>void copy()}><Copy className="h-4 w-4"/>Kopiuj kod HTML</Button><Button disabled={!code} variant="outline" className="min-h-12 gap-2" onClick={download}><Download className="h-4 w-4"/>Pobierz plik HTML</Button></div>
          <p role="status" className="min-h-5 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
          <details ref={codeDetails}><summary className="cursor-pointer text-sm font-medium">Pokaż i zaznacz kod</summary><Label htmlFor="widget-code" className="sr-only">Kod HTML widżetu</Label><textarea ref={codeArea} id="widget-code" readOnly value={code} className="mt-3 h-48 w-full min-w-0 rounded-lg border bg-muted/30 p-3 font-mono text-xs" spellCheck={false}/></details>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Skopiuj kod i wklej go do bloku HTML w edytorze swojej strony.</li><li>Edytor musi pozwalać na własny JavaScript. Jeśli usuwa skrypty, użyj pobranego pliku na swoim hostingu.</li><li>Sprawdź opublikowaną stronę. Możesz dodać kilka widżetów — każdy działa niezależnie.</li></ol>
          <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Kod zawiera HTML, style i skrypt. Nie wymaga bibliotek, połączenia z AI Kreatorem ani kredytów. Zewnętrzne połączenie występuje tylko po wybraniu własnego adresu danych JSON. Kod jest przeznaczony do stron internetowych, nie do e-maili ani komunikatorów.</p>
        </section>
      </div>
    </div>
  </LocalSvgTool>;
}
