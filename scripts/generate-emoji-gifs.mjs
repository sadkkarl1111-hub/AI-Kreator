// Original vector emoji artwork, rendered locally. Existing v1 links stay unchanged.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
const output = fileURLToPath(new URL('../public/gifs/emoji-v1/', import.meta.url));
const catalog = [
  ['smiech', 'Śmiech do łez', 'laugh', 'haha lol smiech śmiech radość'],
  ['serduszka', 'Zakochana buźka', 'love', 'serca miłość milosc love'],
  ['mrugniecie', 'Oczko', 'wink', 'mrugnięcie oczko wink'],
  ['okulary', 'Pełen luz', 'cool', 'okulary luz cool'],
  ['zaskoczenie', 'Ale wow!', 'wow', 'wow zdziwienie zaskoczenie'],
  ['smutek', 'Smutna buźka', 'sad', 'smutek łzy lzy płacz'],
  ['zlosc', 'Złość', 'angry', 'zlosc złość gniew'],
  ['myslenie', 'Zastanawiam się', 'think', 'myslenie myślenie hmm pytanie'],
  ['sen', 'Śpiąca buźka', 'sleep', 'sen dobranoc zmęczenie'],
  ['impreza', 'Czas na imprezę', 'party', 'impreza urodziny konfetti'],
  ['pieniadze', 'Latające banknoty', 'cash', 'cash money pieniądze pieniadze banknoty'],
  ['moneta', 'Złota moneta', 'coin', 'zysk monety kasa sukces'],
  ['ogien', 'Ogień!', 'fire', 'ogien ogień fire gorąco'],
  ['serce', 'Bijące serce', 'heart', 'serce love miłość'],
  ['kciuk', 'Kciuk w górę', 'thumb', 'kciuk tak zgoda super'],
  ['brawa', 'Brawa dla Ciebie', 'clap', 'brawa brawo oklaski gratulacje'],
];
const heart = '<path d="M0 40C-75 -8 -40 -66 0 -33C40 -66 75 -8 0 40Z" fill="#F24D7F"/>';
const eyes = '<ellipse cx="-28" cy="-10" rx="8" ry="13"/><ellipse cx="28" cy="-10" rx="8" ry="13"/>';
const smile = '<path d="M-32 22Q0 57 32 22" fill="none" stroke="#543024" stroke-width="8" stroke-linecap="round"/>';
function art(kind, t) {
  const w = Math.sin(t * Math.PI * 2);
  if (kind === 'heart') return `<g transform="scale(${1 + w * .12})">${heart}</g>`;
  if (kind === 'coin') return `<g transform="scale(${.3 + .7 * Math.abs(Math.cos(t * Math.PI * 2))} 1)"><circle r="78" fill="#FFB522" stroke="#D58112" stroke-width="9"/><circle r="61" fill="#FFDC5C" stroke="#F7A421" stroke-width="5"/><path d="M16 -30H-7Q-31 -30 -25 -10Q-23 0 0 0Q30 0 25 20Q20 35 -18 28M0 -43V43" stroke="#B97013" stroke-width="10" fill="none" stroke-linecap="round"/></g>`;
  if (kind === 'cash') return `<g transform="rotate(${-14 + w * 8})"><path d="M-60 -5Q-130 ${-80 + w * 20} -114 -15L-66 22M60 -5Q130 ${-80 + w * 20} 114 -15L66 22" fill="#F2F8FF" stroke="#AFBFD1" stroke-width="5"/><rect x="-76" y="-42" width="152" height="92" rx="10" fill="#48BD8C" stroke="#1C7856" stroke-width="5"/><rect x="-63" y="-29" width="126" height="66" rx="6" fill="none" stroke="#B1F0CC" stroke-width="5"/><ellipse cy="4" rx="27" ry="30" fill="#BBF3CB"/><text y="17" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="38" fill="#247C54">$</text></g>`;
  if (kind === 'fire') return `<path d="M0 -94C13 -38 73 -40 62 30C50 107 -55 108 -66 39C-74 5 -45 -13 -44 -44C-25 -22 -28 -4 -18 0C-13 -34 4 -50 0 -94" fill="#FF7834"/><path d="M3 -24C12 9 40 22 29 51C16 84 -25 79 -32 48C-37 25 -11 10 3 -24" fill="#FFE16A"/>`;
  if (kind === 'thumb' || kind === 'clap') {
    const hand = '<path d="M-50 62V-10L-16 -46L-8 -84Q18 -94 16 -59L12 -21H54Q76 -20 68 4L48 58Q44 72 26 72H-30Z" fill="#FFD271" stroke="#CB8D31" stroke-width="5" stroke-linejoin="round"/><rect x="-69" y="-7" width="26" height="77" rx="6" fill="#9174E9"/>';
    return kind === 'thumb' ? hand : `<g transform="translate(-20 4) rotate(${-25 + w * 9}) scale(.8)">${hand}</g><g transform="translate(28 -5) rotate(${12 - w * 9}) scale(.8)">${hand}</g><path d="M-10 -110V-125M25 -106 35 -118M-43 -105 -53 -116" stroke="#FFB12F" stroke-width="6" stroke-linecap="round"/>`;
  }
  let face = `${eyes}${smile}`;
  if (kind === 'laugh') face = '<path d="M-42 -9 -25 -22 -10 -9M10 -9 25 -22 42 -9" fill="none" stroke="#543024" stroke-width="7" stroke-linecap="round"/><path d="M-36 16Q0 87 36 16Z" fill="#543024"/><path d="M-20 41Q0 25 20 41L13 53Q0 62 -13 53Z" fill="#F7838F"/><path d="M-62 3Q-90 45 -61 45Q-38 42 -62 3M62 3Q90 45 61 45Q38 42 62 3" fill="#63BCF5"/>';
  if (kind === 'love') face = `<g transform="translate(-31 -9) scale(.38)">${heart}</g><g transform="translate(31 -9) scale(.38)">${heart}</g>${smile}`;
  if (kind === 'wink') face = `<ellipse cx="-28" cy="-10" rx="8" ry="13"/><path d="M15 -7Q28 -20 41 -7" fill="none" stroke="#543024" stroke-width="7" stroke-linecap="round"/>${smile}`;
  if (kind === 'cool') face = `<path d="M-62 -23H-8V2Q-34 30 -57 2ZM8 -23H62L57 2Q34 30 8 2Z" fill="#35364D"/><path d="M-8 -13H8" stroke="#35364D" stroke-width="8"/>${smile}`;
  if (kind === 'wow') face = `${eyes}<ellipse cy="39" rx="17" ry="24"/>`;
  if (kind === 'sad') face = `${eyes}<path d="M-25 43Q0 17 25 43" fill="none" stroke="#543024" stroke-width="7" stroke-linecap="round"/><path d="M40 3Q63 40 42 44Q23 42 40 3Z" fill="#63BCF5"/>`;
  if (kind === 'angry') face = `${eyes}<path d="M-48 -32 -13 -20M13 -20 48 -32M-25 42Q0 24 25 42" fill="none" stroke="#543024" stroke-width="8" stroke-linecap="round"/>`;
  if (kind === 'think') face = `${eyes}<path d="M-25 -38 -48 -34M12 -36 43 -44M-10 37H20" stroke="#543024" stroke-width="7" stroke-linecap="round"/><path d="M34 77 42 23Q54 15 58 29L56 56 73 38Q89 40 78 59L60 87Z" fill="#FFD271" stroke="#CB8D31" stroke-width="4"/>`;
  if (kind === 'sleep') face = '<path d="M-42 -8Q-27 6 -12 -8M12 -8Q27 6 42 -8" fill="none" stroke="#543024" stroke-width="7" stroke-linecap="round"/><ellipse cy="36" rx="10" ry="13"/><text x="58" y="-60" font-family="Arial" font-size="35" font-weight="bold" fill="#7D67CF">Z</text><text x="85" y="-88" font-family="Arial" font-size="23" fill="#7D67CF">z</text>';
  if (kind === 'party') face = `${eyes}${smile}<path d="M-52 -66 -35 -125 8 -83Z" fill="#AA79E8"/><path d="M-39 -103 -7 -93" stroke="#FFE1F1" stroke-width="7"/><path d="M42 22 103 1 90 37Z" fill="#F780AA"/>`;
  return `<defs><radialGradient id="face" cx=".35" cy=".25"><stop stop-color="#FFF393"/><stop offset=".7" stop-color="${kind === 'angry' ? '#FFA760' : '#FFD14A'}"/><stop offset="1" stop-color="${kind === 'angry' ? '#EF7252' : '#F2A827'}"/></radialGradient></defs><circle r="85" fill="url(#face)" stroke="#DE9F32" stroke-width="3"/><g fill="#543024">${face}</g>`;
}
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('../src/data/gif-library.json', import.meta.url))).filter(gif => !gif.src.includes('/emoji-v1/'));
for (const [id, title, kind, keywords] of catalog) {
  const gif = GIFEncoder();
  for (let n = 0; n < 30; n++) {
    const t = n / 30;
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="280" viewBox="0 0 360 280"><g transform="translate(180 ${145 + 5 * Math.sin(t * Math.PI * 2)}) rotate(${3 * Math.sin(t * Math.PI * 2)})">${art(kind, t)}</g></svg>`);
    if (!n) await sharp(svg).png().toFile(`${output}${id}.png`);
    const rgba = await sharp(svg).ensureAlpha().raw().toBuffer();
    const palette = quantize(rgba, 128, { format: 'rgba4444', oneBitAlpha: true });
    const transparentIndex = palette.findIndex(color => color[3] === 0);
    gif.writeFrame(applyPalette(rgba, palette, 'rgba4444'), 360, 280, { palette, delay: 80, repeat: 0, transparent: true, transparentIndex, dispose: 2 });
  }
  gif.finish();
  const bytes = gif.bytes();
  await writeFile(`${output}${id}.gif`, bytes);
  manifest.unshift({ id: `emoji-${id}`, title, category: 'Emoji', keywords, src: `/gifs/emoji-v1/${id}.gif`, poster: `/gifs/emoji-v1/${id}.png`, width: 360, height: 280, bytes: bytes.length });
  console.log(title);
}
await writeFile(new URL('../src/data/gif-library.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
