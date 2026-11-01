// Original vector artwork for the free GIF library. No third-party images or APIs.
// Run manually with: node scripts/generate-gif-library.mjs
// Commit the generated assets so normal builds do not need to render animations.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const output = fileURLToPath(new URL('../public/gifs/v1/', import.meta.url));
const catalog = [
  ['hej', 'Hej!', 'Pozdrowienia', 'smile', 'lavender', 'cześć czesc hello powitanie'],
  ['dzień-dobry', 'Dzień dobry!', 'Pozdrowienia', 'coffee', 'peach', 'dzien dobry rano kawa'],
  ['dobranoc', 'Dobranoc!', 'Pozdrowienia', 'moon', 'night', 'sen noc spij słodkich snów'],
  ['dzieki', 'Dzięki!', 'Pozdrowienia', 'heart', 'pink', 'dziekuje dziękuję thanks podziękowanie'],
  ['przytulam', 'Przytulam!', 'Pozdrowienia', 'heart', 'lavender', 'uścisk uscisk wsparcie hug'],
  ['kawa', 'Kawa?', 'Pozdrowienia', 'coffee', 'mint', 'przerwa kawka spotkanie'],
  ['super', 'Super!', 'Świętowanie', 'star', 'mint', 'świetnie swietnie sukces'],
  ['brawo', 'Brawo!', 'Świętowanie', 'star', 'peach', 'gratulacje brawa oklaski'],
  ['udalo-sie', 'Udało się!', 'Świętowanie', 'check', 'lavender', 'udalo sukces gotowe zrobione'],
  ['sto-lat', 'Sto lat!', 'Świętowanie', 'star', 'pink', 'urodziny życzenia zyczenia impreza'],
  ['piateczka', 'Piąteczka!', 'Świętowanie', 'smile', 'peach', 'piatka piąteczka razem drużyna'],
  ['lecimy', 'Lecimy!', 'Świętowanie', 'rocket', 'sky', 'start rakieta jazda jedziemy'],
  ['haha', 'Haha!', 'Reakcje', 'smile', 'mint', 'śmiech smiech zabawne lol radość'],
  ['wow', 'Wow!', 'Reakcje', 'star', 'lavender', 'zaskoczenie niesamowite zachwyt'],
  ['kocham-to', 'Kocham to!', 'Reakcje', 'heart', 'pink', 'miłość milosc love serce'],
  ['jasne', 'Jasne!', 'Reakcje', 'check', 'sky', 'tak okej ok zgoda dobrze'],
  ['chwila', 'Chwila…', 'Reakcje', 'coffee', 'peach', 'czekaj zaraz moment przerwa'],
  ['dasz-rade', 'Dasz radę!', 'Reakcje', 'rocket', 'mint', 'motywacja wsparcie powodzenia dasz rade'],
];
const colors = {
  lavender: ['#EEE7FF', '#B99AEF', '#352057'],
  peach: ['#FFE9DA', '#FFAD6E', '#612C1B'],
  pink: ['#FFE3ED', '#F580AA', '#6C2342'],
  mint: ['#DFF5E9', '#7ED3B0', '#174C3C'],
  sky: ['#E0F1FF', '#82BEEB', '#23476A'],
  night: ['#29264F', '#F4D487', '#FFF1CE'],
};
const W = 360, H = 280, FRAMES = 30, DELAY = 80;
const star = '<path d="M0 -52 16 -19 52 -13 26 13 32 49 0 32 -32 49 -26 13 -52 -13 -16 -19Z" stroke-linejoin="round"/>';

function artwork(kind, accent, ink, t) {
  const face = `<g fill="${ink}" stroke="none"><ellipse cx="-15" cy="-4" rx="3.5" ry="${t > .43 && t < .5 ? 1 : 5}"/><ellipse cx="15" cy="-4" rx="3.5" ry="${t > .43 && t < .5 ? 1 : 5}"/></g><path d="M-12 13 Q0 26 12 13" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`;
  switch (kind) {
    case 'heart': return `<path d="M0 45C-90 -12 -45 -76 0 -37C45 -76 90 -12 0 45Z" fill="${accent}"/>${face}`;
    case 'star': return `<g fill="${accent}">${star}</g>${face}`;
    case 'smile': return `<circle r="54" fill="${accent}"/>${face}<g fill="#F26883" opacity=".65"><ellipse cx="-32" cy="13" rx="9" ry="5"/><ellipse cx="32" cy="13" rx="9" ry="5"/></g>`;
    case 'check': return `<circle r="52" fill="${accent}"/><path d="M-25 0 -7 19 28 -20" stroke="${ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    case 'coffee': return `<path d="M38 -20H47C76 -20 76 18 42 18" fill="none" stroke="${ink}" stroke-width="7"/><path d="M-46 -25H45V15Q45 47 0 47Q-46 47 -46 15Z" fill="${accent}"/><path d="M-18 -42Q-30 ${-57 - 5 * Math.sin(t * Math.PI * 2)} -14 -68M10 -42Q-2 ${-57 + 5 * Math.sin(t * Math.PI * 2)} 14 -68" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" opacity=".5"/>${face}`;
    case 'moon': return `<path d="M20 -55A56 56 0 1 0 50 35A56 56 0 0 1 20 -55Z" fill="${accent}"/><path d="M-23 7Q-16 14 -9 7" fill="none" stroke="${ink === '#FFF1CE' ? '#625035' : ink}" stroke-width="4" stroke-linecap="round"/>`;
    case 'rocket': return `<path d="M-17 37Q0 ${70 + 8 * Math.sin(t * Math.PI * 4)} 17 37" fill="#FFAE69"/><path d="M-26 7 -46 37 -22 30M26 7 46 37 22 30" fill="${accent}"/><path d="M0 -61Q37 -29 26 34H-26Q-37 -29 0 -61Z" fill="#FFFFFF"/><circle cy="-12" r="16" fill="${accent}"/><circle cy="-12" r="8" fill="${ink}"/><path d="M-13 33H13" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    default: throw new Error(`Unknown artwork: ${kind}`);
  }
}

function frame(entry, n) {
  const [, label, category, kind, theme] = entry;
  const [bg, accent, ink] = colors[theme];
  const t = n / FRAMES, wave = Math.sin(t * Math.PI * 2);
  const scale = kind === 'heart' ? 1 + .07 * wave : 1;
  const decoration = Array.from({ length: 7 }, (_, i) => {
    const x = 46 + ((i * 53) % 280), y = 40 + ((i * 29) % 110);
    const drift = Math.sin(t * Math.PI * 2 + i) * 6;
    return `<g transform="translate(${x} ${y + drift}) rotate(${i * 35 + wave * 15})" fill="${accent}" opacity=".75">${i % 2 ? '<rect x="-3" y="-7" width="6" height="14" rx="2"/>' : '<path d="M0 -7 2 -2 7 0 2 2 0 7 -2 2 -7 0 -2 -2Z"/>'}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="360" height="280" fill="${bg}"/>
    ${decoration}<ellipse cx="180" cy="185" rx="${42 + wave * 3}" ry="7" fill="${ink}" opacity=".09"/>
    <g transform="translate(180 ${112 + wave * 6}) rotate(${kind === 'rocket' ? -12 + wave * 4 : wave * 5}) scale(${scale})">${artwork(kind, accent, ink, t)}</g>
    <text x="180" y="242" text-anchor="middle" font-family="Arial, Liberation Sans, sans-serif" font-weight="800" font-size="${label.length > 10 ? 34 : 40}" fill="${ink}">${label}</text>
  </svg>`;
}

await mkdir(output, { recursive: true });
const manifest = [];
for (const entry of catalog) {
  const [rawId, title, category, , , keywords] = entry;
  const id = rawId.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  const gif = GIFEncoder();
  for (let n = 0; n < FRAMES; n++) {
    const svg = Buffer.from(frame(entry, n));
    if (n === 0) await sharp(svg).png().toFile(`${output}${id}.png`);
    const rgba = await sharp(svg).ensureAlpha().raw().toBuffer();
    const palette = quantize(rgba, 128);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: DELAY, repeat: 0 });
  }
  gif.finish();
  const bytes = gif.bytes();
  await writeFile(`${output}${id}.gif`, bytes);
  manifest.push({ id, title, category, keywords, src: `/gifs/v1/${id}.gif`, poster: `/gifs/v1/${id}.png`, width: W, height: H, bytes: bytes.length });
  console.log(`${id}.gif: ${Math.round(bytes.length / 1024)} KB`);
}
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/gif-library.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
