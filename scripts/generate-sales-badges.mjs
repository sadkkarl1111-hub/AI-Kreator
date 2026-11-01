// Extends the project's native vector badge system. Original artwork, no external assets.
// Rebuild: node scripts/generate-sales-badges.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const output = new URL('public/badges/sales-v1/', root);
const concepts = [
  ['return14', 'Gwarancja zwrotu 14 dni', 'Gwarancje', '14 DNI', 'NA ZWROT', 'GWARANCJA', 'shield'],
  ['return30', 'Gwarancja zwrotu 30 dni', 'Gwarancje', '30 DNI', 'NA ZWROT', 'GWARANCJA', 'shield'],
  ['return60', 'Gwarancja zwrotu 60 dni', 'Gwarancje', '60 DNI', 'NA ZWROT', 'GWARANCJA', 'shield'],
  ['return90', 'Gwarancja zwrotu 90 dni', 'Gwarancje', '90 DNI', 'NA ZWROT', 'GWARANCJA', 'shield'],
  ['year', 'Rok gwarancji', 'Gwarancje', '365 DNI', 'GWARANCJI', 'SPOKOJNY ZAKUP', 'shield'],
  ['satisfaction', 'Gwarancja satysfakcji', 'Gwarancje', 'GWARANCJA', 'SATYSFAKCJI', 'TWÓJ SPOKÓJ', 'check'],
  ['support', 'Gwarancja wsparcia', 'Gwarancje', 'PEŁNE', 'WSPARCIE', 'GWARANCJA', 'chat'],
  ['secure', 'Bezpieczne zakupy', 'Gwarancje', 'BEZPIECZNE', 'ZAKUPY', 'KUPUJ SPOKOJNIE', 'lock'],
  ['pdf', 'Ebook PDF w bonusie', 'Bonusy', 'EBOOK PDF', 'W BONUSIE', 'DODATKOWY MATERIAŁ', 'book'],
  ['video', 'Bonus kurs wideo', 'Bonusy', 'KURS WIDEO', 'W BONUSIE', 'WIĘCEJ WIEDZY', 'play'],
  ['templates', 'Pakiet szablonów gratis', 'Bonusy', 'SZABLONY', 'GRATIS', 'GOTOWE DO UŻYCIA', 'grid'],
  ['checklist', 'Bonus checklista', 'Bonusy', 'CHECKLISTA', 'W BONUSIE', 'KROK PO KROKU', 'check'],
  ['consult', 'Konsultacja w bonusie', 'Bonusy', 'KONSULTACJA', 'W BONUSIE', 'POROZMAWIAJMY', 'chat'],
  ['community', 'Dostęp do grupy', 'Bonusy', 'DOSTĘP', 'DO GRUPY', 'BONUS DLA CIEBIE', 'people'],
  ['bundle', 'Pakiet 5 bonusów', 'Bonusy', '5 BONUSÓW', 'W PAKIECIE', 'WIĘCEJ KORZYŚCI', 'gift'],
  ['updates', 'Aktualizacje gratis', 'Bonusy', 'AKTUALIZACJE', 'GRATIS', 'ZAWSZE NA BIEŻĄCO', 'refresh'],
  ['offer', 'Oferta limitowana', 'Elementy sprzedażowe', 'OFERTA', 'LIMITOWANA', 'SPRAWDŹ SZCZEGÓŁY', 'clock'],
  ['early', 'Cena przedsprzedażowa', 'Elementy sprzedażowe', 'CENA', 'PRZEDSPRZEDAŻOWA', 'ZAREZERWUJ WCZEŚNIEJ', 'spark'],
  ['best', 'Bestseller', 'Elementy sprzedażowe', 'BESTSELLER', 'WYBÓR KLIENTÓW', 'ODKRYJ TERAZ', 'star'],
  ['new', 'Nowość w ofercie', 'Elementy sprzedażowe', 'NOWOŚĆ', 'W OFERCIE', 'ODKRYJ COŚ NOWEGO', 'spark'],
  ['pack', 'W pakiecie taniej', 'Elementy sprzedażowe', 'W PAKIECIE', 'TANIEJ', 'WIĘCEJ ZA MNIEJ', 'gift'],
  ['two', 'Kup 2 zapłać za 1', 'Elementy sprzedażowe', '2 W CENIE 1', 'PODWÓJNA KORZYŚĆ', 'OFERTA SPECJALNA', 'plus'],
  ['discount', 'Rabat minus 20 procent', 'Elementy sprzedażowe', '−20%', 'NA ZAKUPY', 'RABAT DLA CIEBIE', 'tag'],
  ['delivery', 'Darmowa dostawa', 'Elementy sprzedażowe', 'DARMOWA', 'DOSTAWA', 'ZAMÓW WYGODNIE', 'truck'],
];
const styles = [
  ['seal', 'Złota pieczęć', 'Złoty / granatowy', '#172A47', '#F5D78B', '#C4923D'],
  ['shield', 'Metaliczna tarcza', 'Srebrny / niebieski', '#103D71', '#E8F2FF', '#7EB5E4'],
  ['minimal', 'Minimalistyczny', 'Zielony / miętowy', '#134C3C', '#E8F6E9', '#88D5AC'],
  ['sticker', 'Kolorowa naklejka', 'Fioletowy / żółty', '#562CAB', '#FFE77B', '#D4BEFF'],
  ['neon', 'Neon', 'Czarny / turkusowy', '#101D2A', '#A2FFF2', '#2ABFCE'],
  ['stamp', 'Stempel retro', 'Czerwony / kremowy', '#9C2937', '#FFF0D5', '#D65B5E'],
];
const icons = {
  shield:'<path d="M0-36 30-23V2Q28 24 0 38Q-28 24-30 2V-23Z"/><path d="M-15 0-3 12 17-13"/>',
  check:'<path d="M-27 0-7 23 30-26"/>',
  chat:'<path d="M-33-25H33V19H-4L-22 33V19H-33Z"/><path d="M-18-7H18M-18 6H8"/>',
  lock:'<rect x="-27" y="-5" width="54" height="39" rx="7"/><path d="M-17-5V-21A17 17 0 0 1 17-21V-5M0 11V20"/>',
  book:'<path d="M0-26Q-20-37-34-25V28Q-17 19 0 30Q17 19 34 28V-25Q20-37 0-26V30"/>',
  play:'<path d="M-18-30 30 0-18 30Z"/>',
  grid:'<rect x="-31" y="-31" width="25" height="25" rx="4"/><rect x="6" y="-31" width="25" height="25" rx="4"/><rect x="-31" y="6" width="25" height="25" rx="4"/><rect x="6" y="6" width="25" height="25" rx="4"/>',
  people:'<circle cx="0" cy="-17" r="13"/><path d="M-23 32V17Q0-4 23 17V32M-28-26Q-46-24-36-7M28-26Q46-24 36-7M-33 8Q-46 11-46 26M33 8Q46 11 46 26"/>',
  gift:'<path d="M-29-9V33H29V-9M0-17V33"/><rect x="-35" y="-20" width="70" height="14" rx="3"/><path d="M0-21Q-35-56-25-29Q-20-18 0-21Q35-56 25-29Q20-18 0-21"/>',
  refresh:'<path d="M-29 2A29 29 0 0 1 23-19L33-8M33-30V-8H11M29 0A29 29 0 0 1-23 19L-33 8M-33 30V8H-11"/>',
  clock:'<circle r="33"/><path d="M0-20V2L17 12"/>',
  spark:'<path d="M0-37 10-10 37 0 10 10 0 37-10 10-37 0-10-10Z"/>',
  star:'<path d="M0-35 10-12 35-10 16 8 22 33 0 20-22 33-16 8-35-10-10-12Z"/>',
  plus:'<path d="M0-29V29M-29 0H29"/>',
  tag:'<path d="M-34-30H8L37 0 0 37-34 3Z"/><circle cx="-17" cy="-13" r="4"/>',
  truck:'<path d="M-39-22H7V22H-39ZM7-12H25L40 5V22H7M25-12V5H40"/><circle cx="-23" cy="25" r="9"/><circle cx="24" cy="25" r="9"/>',
};
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function scallop() {
  return Array.from({length:72},(_,i)=>{const a=i*Math.PI/36-Math.PI/2,r=i%2?296:320;return `${i?'L':'M'}${400+Math.cos(a)*r},${374+Math.sin(a)*r}`;}).join(' ')+'Z';
}
function render(concept, style) {
  const [, name,, line1,line2,kicker,icon]=concept;
  const [key,,,dark,light,accent]=style;
  const defs=`<defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".35" stop-color="${accent}"/><stop offset=".52" stop-color="${light}"/><stop offset=".78" stop-color="${accent}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>`;
  let shape='', ink=dark, sub=dark, iconY=275, textY=399, footerY=560;
  if(key==='seal') {
    shape=`<path d="M229 538 170 749 290 701 347 758 398 564M402 564 453 758 510 701 630 749 571 538" fill="${dark}" stroke="${accent}" stroke-width="8"/><path d="${scallop()}" fill="url(#metal)"/><circle cx="400" cy="374" r="268" fill="${dark}"/><circle cx="400" cy="374" r="253" fill="none" stroke="${light}" stroke-width="3"/><circle cx="400" cy="374" r="236" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="3 10"/>`;
    ink=light;sub=light;iconY=255;textY=385;footerY=525;
  } else if(key==='shield') {
    shape=`<path d="M400 58 695 151V399Q684 597 400 750Q116 597 105 399V151Z" fill="url(#metal)"/><path d="M400 94 660 176V394Q650 573 400 708Q150 573 140 394V176Z" fill="${dark}"/><path d="M400 119 639 194V389Q630 552 400 680Q170 552 161 389V194Z" fill="none" stroke="${accent}" stroke-width="3"/>`;
    ink=light;sub=light;iconY=262;textY=405;footerY=568;
  } else if(key==='minimal') {
    shape=`<rect x="65" y="184" width="670" height="458" rx="38" fill="${dark}"/><rect x="65" y="170" width="670" height="458" rx="38" fill="${light}" stroke="${dark}" stroke-width="3"/><path d="M108 540H692" stroke="${accent}" stroke-width="2"/><rect x="340" y="224" width="120" height="100" rx="25" fill="${dark}"/>`;
    iconY=274;textY=418;footerY=585;
  } else if(key==='sticker') {
    shape=`<path d="M85 210 678 156 738 540 646 643 122 688 61 291Z" fill="${dark}"/><path d="M85 192 678 138 738 522 646 625 122 670 61 273Z" fill="${light}" stroke="${dark}" stroke-width="8"/><path d="M646 625 635 527 738 522" fill="${accent}" stroke="${dark}" stroke-width="6"/><circle cx="400" cy="270" r="66" fill="${dark}"/>`;
    iconY=270;textY=413;footerY=560;
  } else if(key==='neon') {
    shape=`<path d="M107 160H693L746 217V583L693 640H107L54 583V217Z" fill="${dark}" stroke="${accent}" stroke-width="4"/><path d="M122 180H677L725 229V571L677 620H122L75 571V229Z" fill="none" stroke="${light}" stroke-width="2"/><path d="M150 537H650" stroke="${accent}" stroke-width="2"/><circle cx="400" cy="273" r="59" fill="none" stroke="${accent}" stroke-width="3"/>`;
    ink=light;sub=light;iconY=273;textY=420;footerY=582;
  } else {
    shape=`<g transform="rotate(-5 400 400)"><rect x="73" y="163" width="654" height="470" rx="30" fill="${light}" stroke="${dark}" stroke-width="11"/><rect x="96" y="187" width="608" height="422" rx="15" fill="none" stroke="${dark}" stroke-width="3" stroke-dasharray="8 5"/><path d="M130 533H670" stroke="${accent}" stroke-width="3"/></g><circle cx="400" cy="265" r="56" fill="${dark}"/>`;
    iconY=265;textY=411;footerY=576;
  }
  const text=(str,y,max,weight=800,fill=ink)=>`<text x="400" y="${y}" text-anchor="middle" font-family="Arial, Liberation Sans, sans-serif" font-weight="${weight}" font-size="${Math.min(max,Math.floor(535/(str.length*.69)))}" fill="${fill}">${escape(str)}</text>`;
  const iconColor=['minimal','sticker','stamp'].includes(key)?light:ink;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 800 800"><title>${escape(name+' — '+style[1])}</title>${defs}${shape}<g transform="translate(400 ${iconY})" fill="none" stroke="${iconColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</g>${text(line1,textY,line1.length<7?84:54)}${text(line2,textY+64,44)}${text(kicker,footerY,22,700,sub)}</svg>`;
}
await mkdir(output,{recursive:true});
const catalog=[];
for(const concept of concepts) for(const style of styles) {
  const id=`sales-v1-${concept[0]}-${style[0]}`;
  const svg=render(concept,style);
  await writeFile(new URL(id+'.svg',output),svg);
  await sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(fileURLToPath(new URL(id+'.png',output)));
  catalog.push({id,name:`${concept[1]} — ${style[1].toLocaleLowerCase('pl')}`,description:`${style[1]} · ${style[2]} · PNG 1000 px, przezroczyste tło`,category:concept[2],style:style[1],color:style[2],src:`/badges/sales-v1/${id}.png`,addedAt:'2026-11-01T00:00:00Z'});
}
await writeFile(new URL('src/data/sales-badges.json',root),JSON.stringify(catalog,null,2)+'\n');
console.log(`Generated ${catalog.length} original badges in ${styles.length} styles.`);
