export const TEXT_EFFECTS = [
  { id: 'depth', name: '3D', color: '#f9d83b', accent: '#933516', background: '#201336' },
  { id: 'neon', name: 'Neon', color: '#fdf4ff', accent: '#d946ef', background: '#160d2b' },
  { id: 'gold', name: 'Złoto', color: '#ffe69a', accent: '#a66a13', background: '#191713' },
  { id: 'outline', name: 'Obrys', color: '#ffffff', accent: '#7c3aed', background: '#f2eaff' },
  { id: 'shadow', name: 'Cień', color: '#ffffff', accent: '#312e81', background: '#6366f1' },
  { id: 'gradient', name: 'Gradient', color: '#f472b6', accent: '#7c3aed', background: '#fff1f7' },
] as const;
export const TEXT_FONTS = [
  { id: 'impact', name: 'Mocny', family: 'Impact, "Arial Black", sans-serif', weight: 900 },
  { id: 'arial', name: 'Klasyczny', family: 'Arial, Helvetica, sans-serif', weight: 700 },
  { id: 'georgia', name: 'Elegancki', family: 'Georgia, "Times New Roman", serif', weight: 700 },
  { id: 'mono', name: 'Maszynowy', family: '"Courier New", monospace', weight: 700 },
] as const;
export type TextEffectOptions = { text: string; effect: string; font: string; size: number; spacing: number; strength: number; color: string; accent: string; transparent: boolean; background: string };
export const defaultTextEffectOptions: TextEffectOptions = { text: 'TWOJA MARKA', effect: 'depth', font: 'impact', size: 150, spacing: 2, strength: 12, color: '#f9d83b', accent: '#933516', transparent: true, background: '#201336' };
export const escapeSvgText = (value: string) => Array.from(value).filter(char => {
  const code = char.codePointAt(0)!;
  return (code >= 32 || code === 9 || code === 10 || code === 13) && code !== 65534 && code !== 65535;
}).join('').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const clamp = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const safeColor = (value: string, fallback: string) => /^#[\da-f]{6}$/i.test(value) ? value : fallback;

export function buildTextEffectSvg(options: TextEffectOptions, measure: (text: string, size: number, family: string, weight: number) => number) {
  const effect = TEXT_EFFECTS.find(item => item.id === options.effect)?.id ?? 'depth';
  const font = TEXT_FONTS.find(item => item.id === options.font) ?? TEXT_FONTS[0];
  const lines = options.text.slice(0, 240).replace(/\r/g, '').split('\n').slice(0, 4);
  if (!lines.some(line => line.trim())) return null;
  const width = 1200, padding = 100;
  const longestLine = Math.max(...lines.map(line => Array.from(line).length));
  const spacing = Math.min(clamp(options.spacing, 2, 0, 12), 400 / Math.max(1, longestLine - 1));
  let size = clamp(options.size, 150, 48, 220);
  // Match the actual browser font and fit long lines without cutting off effects or accents.
  const widest = (atSize: number) => Math.max(...lines.map(line => measure(line, atSize, font.family, font.weight) + Math.max(0, Array.from(line).length - 1) * spacing));
  for (let i = 0; i < 8 && widest(size) > width - 2 * padding; i++) size = Math.max(2, size * 0.85);
  while (widest(size) > width - 2 * padding && size > 2) size *= 0.9;
  const strength = clamp(options.strength, 12, 2, 24);
  const height = Math.ceil(Math.max(320, padding * 2 + size * (1.25 * lines.length + 0.2)));
  const color = safeColor(options.color, '#f9d83b'), accent = safeColor(options.accent, '#933516');
  const attributes = `text-anchor="middle" font-family="${escapeSvgText(font.family)}" font-weight="${font.weight}" font-size="${size.toFixed(2)}" letter-spacing="${spacing}" stroke-linejoin="round" paint-order="stroke fill"`;
  const text = (fill: string, extra = '', offset = 0) => `<g ${attributes} fill="${fill}" ${extra}>${lines.map((line, index) => `<text xml:space="preserve" x="${width / 2 + offset}" y="${(padding + size + index * size * 1.25 + offset).toFixed(2)}">${escapeSvgText(line)}</text>`).join('')}</g>`;
  const background = options.transparent ? '' : `<rect width="${width}" height="${height}" fill="${safeColor(options.background, '#201336')}"/>`;
  let definitions = '', artwork = '';
  switch (effect) {
    case 'depth':
      for (let step = Math.round(strength); step > 0; step--) artwork += text(accent, `stroke="${accent}" stroke-width="1"`, step);
      artwork += text(color, `stroke="${accent}" stroke-width="1.5"`);
      break;
    case 'neon':
      definitions = `<filter id="glow" x="-50%" y="-100%" width="200%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${strength / 2}"/></filter>`;
      artwork = text(accent, `stroke="${accent}" stroke-width="${strength / 2}" filter="url(#glow)"`) + text('none', `stroke="${accent}" stroke-width="${strength / 2 + 2}"`) + text('none', `stroke="${color}" stroke-width="${Math.max(1, strength / 5)}"`);
      break;
    case 'gold':
      definitions = `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="0.3" stop-color="${accent}"/><stop offset="0.48" stop-color="${color}"/><stop offset="0.52" stop-color="#fffce0"/><stop offset="0.6" stop-color="${accent}"/><stop offset="1" stop-color="${color}"/></linearGradient>`;
      artwork = text(accent, `stroke="${accent}" stroke-width="2"`, Math.max(2, strength / 4)) + text('url(#gold)', `stroke="${accent}" stroke-width="1.5"`);
      break;
    case 'outline': artwork = text(color, `stroke="${accent}" stroke-width="${strength}"`); break;
    case 'shadow':
      definitions = `<filter id="shadow" x="-50%" y="-100%" width="200%" height="300%" color-interpolation-filters="sRGB"><feDropShadow dx="${strength / 2}" dy="${strength / 2}" stdDeviation="${strength / 3}" flood-color="${accent}" flood-opacity="0.85"/></filter>`;
      artwork = text(color, 'filter="url(#shadow)"');
      break;
    case 'gradient':
      definitions = `<linearGradient id="gradient"><stop stop-color="${color}"/><stop offset="1" stop-color="${accent}"/></linearGradient>`;
      artwork = text('url(#gradient)'); break;
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${escapeSvgText(lines.join(' '))}</title><defs>${definitions}</defs>${background}${artwork}</svg>`;
  return { svg, width, height, fontSize: Math.round(size) };
}
