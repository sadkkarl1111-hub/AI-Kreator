import iconLicense from './svgIconLicense.txt?raw';

export const SVG_STYLES = [
  { id: 'waves', name: 'Fale', category: 'Tła' },
  { id: 'blobs', name: 'Organiczne kształty', category: 'Tła' },
  { id: 'rays', name: 'Promienie', category: 'Tła' },
  { id: 'dots', name: 'Kropki', category: 'Wzory' },
  { id: 'grid', name: 'Siatka', category: 'Wzory' },
  { id: 'confetti', name: 'Konfetti', category: 'Wzory' },
  { id: 'mountains', name: 'Góry', category: 'Ilustracje' },
  { id: 'sunset', name: 'Zachód słońca', category: 'Ilustracje' },
  { id: 'plant', name: 'Roślina', category: 'Ilustracje' },
  { id: 'rocket', name: 'Rakieta', category: 'Ilustracje' },
  { id: 'flower', name: 'Kwiat', category: 'Ilustracje' },
  { id: 'sticker', name: 'Naklejka z napisem', category: 'Do reklam' },
] as const;

export type SvgStyle = (typeof SVG_STYLES)[number]['id'];
export type SvgOptions = {
  style: SvgStyle;
  width: number;
  height: number;
  primary: string;
  secondary: string;
  background: string;
  transparent: boolean;
  seed: number;
  density: number;
  text: string;
};

export const DEFAULT_SVG_OPTIONS: SvgOptions = {
  style: 'waves', width: 1200, height: 800, primary: '#a855f7', secondary: '#38bdf8',
  background: '#f5f3ff', transparent: false, seed: 1, density: 12, text: 'SUPER OFERTA',
};

export const SVG_PALETTES = [
  { name: 'Fiolet i błękit', primary: '#a855f7', secondary: '#38bdf8', background: '#f5f3ff' },
  { name: 'Ciepłe lato', primary: '#f97316', secondary: '#fbbf24', background: '#fff7ed' },
  { name: 'Zieleń', primary: '#059669', secondary: '#a3e635', background: '#ecfdf5' },
  { name: 'Róż', primary: '#db2777', secondary: '#fb7185', background: '#fff1f2' },
  { name: 'Noc', primary: '#818cf8', secondary: '#22d3ee', background: '#0f172a' },
];

const xml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const bounded = (value: number, fallback: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback)));
const color = (value: string, fallback: string) => /^#[\da-f]{6}$/i.test(value) ? value : fallback;
export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function generateSvg(options: SvgOptions): string {
  const width = bounded(options.width, 1200, 64, 4096);
  const height = bounded(options.height, 800, 64, 4096);
  const primary = color(options.primary, '#a855f7');
  const secondary = color(options.secondary, '#38bdf8');
  const background = color(options.background, '#f5f3ff');
  const density = bounded(options.density, 12, 4, 40);
  let seed = bounded(options.seed, 1, 0, 2147483647) || 1;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const backgroundRect = options.transparent ? '' : `<rect width="1200" height="800" fill="${background}"/>`;
  let artwork = '';
  switch (options.style) {
    case 'waves':
      for (let i = 0; i < Math.ceil(density / 3); i++) {
        const y = 220 + i * 90;
        artwork += `<path d="M0 ${y} C300 ${y - 180 * random()} 800 ${y + 260 * random()} 1200 ${y - 70} V800 H0Z" fill="${i % 2 ? secondary : primary}" opacity="${0.25 + i * 0.06}"/>`;
      }
      break;
    case 'blobs':
      for (let i = 0; i < Math.ceil(density / 2); i++) {
        const x = Math.round(random() * 1200), y = Math.round(random() * 800), r = 80 + Math.round(random() * 170);
        artwork += `<path d="M${x - r} ${y} C${x - r} ${y - r * 1.5} ${x + r} ${y - r} ${x + r} ${y} S${x - r * 0.3} ${y + r * 1.5} ${x - r} ${y}Z" fill="${i % 2 ? secondary : primary}" opacity="0.65"/>`;
      }
      break;
    case 'dots':
    case 'grid': {
      const step = Math.round(2400 / density);
      const offset = Math.round(random() * step);
      artwork = options.style === 'dots'
        ? `<defs><pattern id="pattern" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="translate(${offset} ${offset})"><circle cx="${step / 2}" cy="${step / 2}" r="${step / 8}" fill="${primary}"/><circle cx="0" cy="0" r="${step / 10}" fill="${secondary}"/></pattern></defs>`
        : `<defs><pattern id="pattern" width="${step}" height="${step}" patternUnits="userSpaceOnUse" patternTransform="translate(${offset} ${offset})"><path d="M${step} 0H0V${step}" fill="none" stroke="${primary}" stroke-width="3"/></pattern></defs>`;
      artwork += '<rect width="1200" height="800" fill="url(#pattern)"/>';
      break;
    }
    case 'confetti':
      for (let i = 0; i < density * 5; i++) {
        const x = Math.round(random() * 1200), y = Math.round(random() * 800), rotation = Math.round(random() * 360);
        artwork += `<rect x="${x}" y="${y}" width="12" height="32" rx="4" fill="${i % 2 ? secondary : primary}" transform="rotate(${rotation} ${x} ${y})"/>`;
      }
      break;
    case 'rays': {
      const phase = random() * Math.PI * 2;
      for (let i = 0; i < density; i++) {
        const a = i * Math.PI * 2 / density + phase, b = a + Math.PI / density;
        artwork += `<path d="M600 400L${600 + Math.cos(a) * 1600} ${400 + Math.sin(a) * 1600}L${600 + Math.cos(b) * 1600} ${400 + Math.sin(b) * 1600}Z" fill="${i % 2 ? secondary : primary}" opacity="0.6"/>`;
      }
      break;
    }
    case 'mountains':
      artwork = `<circle cx="900" cy="190" r="85" fill="${secondary}"/><path d="M0 800V550L300 160L620 650L850 290L1200 650V800Z" fill="${primary}" opacity="0.5"/><path d="M0 800L390 370L620 690L900 420L1200 800Z" fill="${primary}"/><path d="M245 233L300 160L360 252L308 232L280 259Z" fill="white" opacity="0.8"/>`;
      break;
    case 'sunset':
      artwork = `<circle cx="600" cy="340" r="190" fill="${secondary}"/><path d="M0 440Q300 370 600 440T1200 440V800H0Z" fill="${primary}"/><g stroke="${secondary}" stroke-width="12" stroke-linecap="round">${Array.from({ length: 6 }, (_, i) => `<path d="M${420 + i * 15} ${490 + i * 42}H${780 - i * 15}" opacity="${0.8 - i * 0.1}"/>`).join('')}</g>`;
      break;
    case 'plant':
      artwork = `<path d="M595 595V180" stroke="${primary}" stroke-width="18" stroke-linecap="round"/><path d="M595 380Q380 370 360 150Q585 165 595 380Z" fill="${primary}"/><path d="M605 460Q820 425 855 230Q625 240 605 460Z" fill="${secondary}"/><path d="M590 550Q420 540 425 380Q565 405 590 550Z" fill="${secondary}"/><path d="M450 565H750L710 745H490Z" fill="${primary}"/><rect x="435" y="555" width="330" height="38" rx="15" fill="${secondary}"/>`;
      break;
    case 'rocket':
      artwork = `<circle cx="970" cy="150" r="10" fill="${secondary}"/><circle cx="250" cy="240" r="14" fill="${primary}"/><circle cx="930" cy="630" r="16" fill="${primary}"/><path d="M525 560L600 760L675 560Z" fill="${secondary}"/><path d="M490 400L390 615L515 570M710 400L810 615L685 570" fill="${secondary}"/><path d="M510 590Q460 250 600 90Q740 250 690 590Z" fill="${primary}"/><circle cx="600" cy="350" r="65" fill="white"/><circle cx="600" cy="350" r="43" fill="${secondary}"/>`;
      break;
    case 'flower':
      artwork = `<path d="M600 400V740" stroke="${primary}" stroke-width="20"/><path d="M600 655Q390 640 400 480Q585 500 600 655Z" fill="${primary}"/>${Array.from({ length: 8 }, (_, i) => `<ellipse cx="600" cy="220" rx="65" ry="125" fill="${secondary}" transform="rotate(${i * 45} 600 380)"/>`).join('')}<circle cx="600" cy="380" r="110" fill="${primary}"/>`;
      break;
    case 'sticker': {
      const angle = random() * 0.4;
      const points = Array.from({ length: 32 }, (_, i) => {
        const a = i * Math.PI / 16 + angle, r = i % 2 ? 250 : 320;
        return `${600 + Math.cos(a) * r},${400 + Math.sin(a) * r}`;
      }).join(' ');
      const label = options.text.slice(0, 48);
      artwork = `<polygon points="${points}" fill="${primary}"/><circle cx="600" cy="400" r="224" fill="none" stroke="${secondary}" stroke-width="5"/><text x="600" y="400" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${Math.min(64, 550 / Math.max(1, Array.from(label).length))}" fill="${secondary}">${xml(label)}</text>`;
      break;
    }
  }
  if (['mountains', 'sunset', 'plant', 'rocket', 'flower'].includes(options.style)) {
    artwork = `<g transform="translate(${Math.round((random() - 0.5) * 80)} ${Math.round((random() - 0.5) * 50)})">${artwork}</g>`;
  }
  const label = SVG_STYLES.find(style => style.id === options.style)?.name || 'Grafika SVG';
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"><title>${xml(label)}</title>${backgroundRect}${artwork}</svg>`;
}

export function serializeIconSvg(element: SVGSVGElement, label: string, size: number): string {
  const clone = element.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(bounded(size, 256, 16, 2048)));
  clone.setAttribute('height', clone.getAttribute('width')!);
  clone.removeAttribute('class');
  clone.removeAttribute('aria-hidden');
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  title.textContent = label;
  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  metadata.textContent = iconLicense;
  clone.prepend(title, metadata);
  return `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(clone)}`;
}

export function downloadSvg(svg: string, name: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSvgPng(svg: string, name: string) {
  const image = new Image();
  image.src = svgDataUrl(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Nie udało się przygotować PNG');
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Nie udało się zapisać PNG')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
