/* Standalone runtime: exported verbatim into downloaded HTML. No imports or tracking. */
(() => {
  const tag = 'ak-live-widget-v1';
  if (customElements.get(tag)) return;
  const css = `
    :host{display:block;width:100%;container-type:inline-size;color-scheme:normal}
    *,*::before,*::after{box-sizing:border-box}
    .shell{font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--bg);border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);border-radius:var(--radius);padding:clamp(20px,5cqw,36px);overflow:hidden;line-height:1.5}
    .shell.neon{box-shadow:inset 0 0 35px color-mix(in srgb,var(--accent) 10%,transparent);border-color:var(--accent)}
    .shell.ticket{border:2px dashed var(--accent)}
    h2{font-size:clamp(20px,4.5cqw,30px);line-height:1.2;margin:0 0 10px;font-weight:800;overflow-wrap:anywhere}
    .subtitle,.details,.source,.status{font-size:14px;margin:0 0 20px;opacity:.8;overflow-wrap:anywhere}
    .source,.status{font-size:12px;margin:12px 0 0;opacity:.8}
    .status:empty,.source:empty{display:none}.status.error{opacity:1}
    .digits{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;font-variant-numeric:tabular-nums}
    .digit{padding:14px 4px;text-align:center;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:calc(var(--radius)*.55);background:color-mix(in srgb,var(--accent) 9%,var(--bg))}
    .digit strong{display:block;font-size:clamp(24px,7cqw,50px);line-height:1.1;color:var(--accent);font-weight:800;overflow-wrap:anywhere}
    .digit span{display:block;font-size:12px;margin-top:7px}
    .metric{font-size:clamp(40px,12cqw,76px);font-weight:800;line-height:1.1;letter-spacing:-.04em;color:var(--accent);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;margin:0 0 12px}
    .details{margin:10px 0 0}.track{height:18px;border-radius:999px;background:color-mix(in srgb,var(--ink) 12%,var(--bg));overflow:hidden}
    .fill{height:100%;width:0;background:var(--accent);border-radius:inherit;position:relative;transition:width .7s ease;min-width:0}
    .animated .fill::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 25%,#ffffff66 50%,transparent 75%);animation:ak-shine 3s linear infinite}
    .shell:not(.animated) .fill{transition:none}
    .expired{font-weight:700;font-size:18px;color:var(--accent);margin:16px 0 0}.expired:empty{display:none}
    @keyframes ak-shine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
    @container(max-width:360px){.digits{grid-template-columns:repeat(2,minmax(0,1fr))}.digit strong{font-size:36px}}
    @media(prefers-reduced-motion:reduce){.fill{transition:none}.animated .fill::after{animation:none;display:none}}
  `;
  const node = (tagName, className, text) => {
    const el = document.createElement(tagName);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  };
  const setText = (el,text) => { if(el.textContent!==text)el.textContent=text; };
  const parts = (time, zone) => {
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(time);
    const get = type => Number(formatted.find(p=>p.type===type).value);
    return { day:Date.UTC(get('year'),get('month')-1,get('day')), clock:get('hour')*60+get('minute') };
  };
  const clamp = (n, max) => Math.min(max,Math.max(0,n));
  const placeWord = n => n===1?'miejsce':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'miejsca':'miejsc';
  class LiveWidget extends HTMLElement {
    static get observedAttributes() { return ['data-config']; }
    connectedCallback() { this.mount(); }
    disconnectedCallback() { this.cleanup(); }
    attributeChangedCallback() { if(this.isConnected) this.mount(); }
    cleanup() {
      clearInterval(this.timer); clearInterval(this.poll); clearTimeout(this.timeout);
      if(this.controller) this.controller.abort();
      this.generation=(this.generation||0)+1;
    }
    mount() {
      this.cleanup();
      const root=this.shadowRoot||this.attachShadow({mode:'open'}); root.replaceChildren();
      let c;
      try { c=JSON.parse(this.getAttribute('data-config')||'{}'); if(c.version!==1||!['countdown','seats','progress'].includes(c.kind)) throw new Error(); }
      catch { root.append(node('p','','Nieprawidłowa konfiguracja widżetu.')); return; }
      const generation=this.generation;
      const style=node('style'); style.textContent=css; root.append(style);
      const shell=node('section','shell '+(['light','dark','neon','ticket'].includes(c.theme)?c.theme:'light')+(c.animated?' animated':''));
      for(const [key,value,fallback] of [['--accent',c.accent,'#9333ea'],['--bg',c.background,'#ffffff'],['--ink',c.foreground,'#241b35']]) shell.style.setProperty(key,/^#[\da-f]{6}$/i.test(value)?value:fallback);
      shell.style.setProperty('--radius',clamp(Number(c.radius)||0,40)+'px');
      shell.append(node('h2','',c.title||'Widżet'));
      if(c.subtitle) shell.append(node('p','subtitle',c.subtitle));
      root.append(shell);
      const status=node('p','status'); status.setAttribute('role','status');
      const source=node('p','source');
      const dateText = value => new Intl.DateTimeFormat('pl-PL',{timeZone:c.zone,dateStyle:'long',timeStyle:'short'}).format(value)+' ('+c.zone+')';
      const number = value => new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(value);
      if(c.kind==='countdown') {
        const timer=node('div','digits'); timer.setAttribute('role','timer'); timer.setAttribute('aria-label','Czas do wydarzenia'); timer.setAttribute('aria-live','off');
        const digits=['Dni','Godz.','Min.','Sek.'].map(label=>{const cell=node('div','digit');const value=node('strong','','00');cell.append(value,node('span','',label));timer.append(cell);return value;});
        shell.append(timer);
        if(c.showDetails) shell.append(node('p','details',dateText(c.end)));
        const endMessage=node('p','expired');endMessage.setAttribute('role','status');shell.append(endMessage);
        const update=()=>{
          const seconds=Math.max(0,Math.ceil((c.end-Date.now())/1000));
          const values=[Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60];
          values.forEach((value,i)=>{const text=String(value).padStart(2,'0');if(digits[i].textContent!==text){digits[i].textContent=text;if(c.animated&&digits[i].animate&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches))digits[i].animate([{opacity:.45,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});}});
          if(seconds===0){endMessage.textContent=c.finishText||'Termin minął.';clearInterval(this.timer);}
        };
        update();if(c.end>Date.now())this.timer=setInterval(update,1000);return;
      }
      let total=Number(c.total),value=Number(c.value),remoteReady=false;
      const metric=node('p','metric'); const track=node('div','track'); const fill=node('div','fill');track.append(fill);
      track.setAttribute('role','progressbar'); track.setAttribute('aria-label',c.kind==='seats'?'Zajęte miejsca':'Postęp');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
      const detail=node('p','details');const complete=node('p','expired');complete.setAttribute('role','status');shell.append(metric,track);if(c.showDetails)shell.append(detail);shell.append(source,complete,status);
      const timeProgress=c.kind==='progress'&&c.progressMode==='time';
      if(!timeProgress&&c.source==='daily') source.textContent='Wartość według harmonogramu dziennego. Nie jest odczytem zapisów.';
      if(!timeProgress&&c.source==='steps') source.textContent='Wartość według ustawionych dat. Nie jest odczytem zapisów.';
      if(!timeProgress&&c.source==='manual') source.textContent='Wartość ustawiona ręcznie.';
      const render=()=>{
        const now=Date.now();let current=value,max=total;
        if(timeProgress){max=100;current=clamp((now-c.start)/(c.end-c.start)*100,100);}
        else if(c.source==='daily'){
          const from=parts(c.start,c.zone),today=parts(now,c.zone);
          const days=Math.max(0,Math.round((today.day-from.day)/86400000)-(today.clock<from.clock?1:0));
          current=clamp(value+days*Number(c.delta),max);
        }else if(c.source==='steps'){
          const latest=[...(c.steps||[])].filter(step=>step.at<=now).sort((a,b)=>a.at-b.at).pop();
          if(latest)current=Number(latest.value);
        }
        const unavailable=!timeProgress&&c.source==='url'&&!remoteReady;
        current=clamp(current,max);
        const percent=c.kind==='seats'?(max-current)/max*100:current/max*100;
        setText(metric,unavailable?'—':c.kind==='seats'?number(current)+' '+placeWord(current):number(Math.round(percent*10)/10)+'%');
        fill.style.width=(unavailable?0:clamp(percent,100))+'%';
        if(unavailable)track.removeAttribute('aria-valuenow');else track.setAttribute('aria-valuenow',String(Math.round(percent*10)/10));
        setText(detail,unavailable?'Oczekiwanie na aktualne dane.':timeProgress?'Od '+dateText(c.start)+' do '+dateText(c.end):c.kind==='seats'?'Wolne miejsca: '+number(current)+' z '+number(max)+'. Pasek pokazuje zajęte miejsca.':'Wykonano '+number(current)+' z '+number(max)+'.');
        setText(complete,!unavailable&&(c.kind==='seats'?current===0:current>=max)?c.finishText||'Cel osiągnięty.':'');
      };
      render();this.timer=setInterval(render,1000);
      if(timeProgress||c.source!=='url')return;
      let address;
      try{address=new URL(c.endpoint);if(address.protocol!=='https:'||address.username||address.password)throw new Error();}
      catch{status.textContent='Nieprawidłowy adres danych.';return;}
      let pending=false;
      const refresh=async()=>{
        if(pending)return;pending=true;const controller=new AbortController();this.controller=controller;
        const requestTimeout=setTimeout(()=>controller.abort(),10000);this.timeout=requestTimeout;
        if(!remoteReady)status.textContent='Pobieram dane…';
        try{
          const response=await fetch(address.href,{signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
          if(!response.ok)throw new Error();
          const data=await response.json();const nextTotal=data.total;const nextValue=c.kind==='seats'?data.remaining:data.current;
          if(typeof nextTotal!=='number'||!Number.isFinite(nextTotal)||nextTotal<=0||nextTotal>1000000||typeof nextValue!=='number'||!Number.isFinite(nextValue)||nextValue<0||nextValue>nextTotal||(c.kind==='seats'&&(!Number.isInteger(nextTotal)||!Number.isInteger(nextValue))))throw new Error();
          if(this.generation!==generation||!this.isConnected)return;
          total=nextTotal;value=nextValue;remoteReady=true;status.classList.remove('error');
          status.textContent='Dane odświeżone: '+new Intl.DateTimeFormat('pl-PL',{timeZone:c.zone,timeStyle:'short'}).format(Date.now())+'.';source.textContent='Dane z podłączonego źródła. Odświeżanie co minutę.';render();
        }catch{
          if(this.generation!==generation||!this.isConnected)return;
          status.classList.add('error');status.textContent=remoteReady?'Nie udało się odświeżyć danych. Wyświetlam ostatni poprawny odczyt.':'Nie udało się odczytać danych. Sprawdź adres i dostęp CORS.';
        }finally{clearTimeout(requestTimeout);pending=false;}
      };
      void refresh();this.poll=setInterval(refresh,60000);
    }
  }
  customElements.define(tag,LiveWidget);
})();
