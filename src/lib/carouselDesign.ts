import { fitImageRect } from './localDesignExport';
import { carouselFont, drawRichText, type TextMark } from './carouselRichText';
import { drawSlideStickers, type SlideSticker } from './carouselStickers';
import type { StickerImages } from './carouselStickerAssets';
import { drawCarouselImage } from './carouselFrames';
import { type CarouselTextBox, type CarouselTextField, type CarouselTextFrame } from './carouselTextGeometry';
import { drawCarouselNavigation, type CarouselNavigation } from './carouselNavigation';
import { carouselContrast, type CarouselComposition, type CarouselCta } from './carouselConversion';
import { renderCreatorComposition } from './carouselCreatorLayouts';

export type CarouselTone = 'theme' | 'light' | 'dark' | 'accent';
export const CAROUSEL_TONES = [{ id: 'theme', name: 'Wspólne tło karuzeli' }, { id: 'light', name: 'Jasny slajd' }, { id: 'dark', name: 'Ciemny slajd' }, { id: 'accent', name: 'Kolor marki' }] as const;
export type CarouselSlide = { id: string; layout: 'cover' | 'content' | 'quote'; kicker: string; title: string; body: string; image: string; imageFrame?: string; imageSource?: 'ai-sample'; tone?: CarouselTone; titleMarks?: TextMark[]; bodyMarks?: TextMark[]; kickerMarks?: TextMark[]; textFrames?: Partial<Record<CarouselTextField, CarouselTextFrame>>; stickers?: SlideSticker[]; composition?: CarouselComposition; cta?: CarouselCta };
export type CarouselDesign = {
  format: 'portrait' | 'square'; theme: string; brand: string; accent: string;
  logo?: string; brandMode?: 'text' | 'logo' | 'both'; logoSize?: number; logoPlate?: boolean;
  background?: string; backgroundColor?: string; backgroundImage?: string; backgroundShield?: number;
  titleFont?: string; bodyFont?: string; titleScale?: number; bodyScale?: number;
  navigation?: CarouselNavigation;
};
export const CAROUSEL_THEMES = [
  { id: 'studio', name: 'Studio', background: '#17142b', foreground: '#ffffff', muted: '#c1bbd6', accent: '#c4a1ff' },
  { id: 'paper', name: 'Papier', background: '#f6f1e7', foreground: '#243b34', muted: '#53655d', accent: '#527b64' },
  { id: 'bold', name: 'Energia', background: '#ffe3c5', foreground: '#30221b', muted: '#705846', accent: '#ab3b12' },
  { id: 'minimal', name: 'Minimal', background: '#ffffff', foreground: '#151a25', muted: '#596171', accent: '#6041cc' },
  { id: 'newspaper', name: 'Gazeta', background: '#f2eadb', foreground: '#28251f', muted: '#565044', accent: '#9e3529' },
  { id: 'clay', name: 'Miękkie 3D', background: '#e8e0f8', foreground: '#2a1f49', muted: '#53476b', accent: '#7145b5' },
  { id: 'glass', name: 'Szkło i neon', background: '#10233d', foreground: '#ffffff', muted: '#d0deec', accent: '#73eddc' },
  { id: 'editorial', name: 'Magazyn', background: '#f7f5f0', foreground: '#252d42', muted: '#596071', accent: '#bf4433' },
  { id: 'retro', name: 'Retro', background: '#f2d6af', foreground: '#49382b', muted: '#6d5240', accent: '#a53c24' },
  { id: 'blueprint', name: 'Projekt', background: '#123c65', foreground: '#ffffff', muted: '#c6d9ed', accent: '#8bd7ff' },
  { id: 'creator-red', name: 'Twórca · czerwony', background: '#101114', foreground: '#ffffff', muted: '#c8c8cd', accent: '#f43d36' },
  { id: 'creator-cream', name: 'Twórca · papier', background: '#f8f5ef', foreground: '#151515', muted: '#52525b', accent: '#db342d' },
  { id: 'creator-lime', name: 'Twórca · limonka', background: '#111511', foreground: '#ffffff', muted: '#c6d0c3', accent: '#c5f45b' },
  { id: 'creator-blue', name: 'Twórca · kobalt', background: '#f5f7ff', foreground: '#101b42', muted: '#4b5878', accent: '#2955ed' },
  { id: 'creator-lilac', name: 'Twórca · lawenda', background: '#171320', foreground: '#ffffff', muted: '#d2c9df', accent: '#c2a3f4' },
  { id: 'creator-orange', name: 'Twórca · pomarańcz', background: '#fbf5e9', foreground: '#242018', muted: '#665e51', accent: '#f15b2a' },
] as const;
export const CAROUSEL_BACKGROUNDS = [
  { id: 'theme', name: 'Tło wybranego stylu' }, { id: 'solid', name: 'Jednolity kolor' },
  { id: 'gradient', name: 'Gradient' }, { id: 'mesh', name: 'Miękkie plamy koloru' },
  { id: 'grid', name: 'Siatka' }, { id: 'dots', name: 'Kropki' },
  { id: 'paper', name: 'Papier gazetowy' }, { id: 'depth', name: 'Bryły 3D' },
  { id: 'photo', name: 'Własne zdjęcie' },
] as const;
export const defaultCarouselDesign: CarouselDesign = { format: 'portrait', theme: 'studio', brand: '@twojamarka', accent: '#c4a1ff', logo: '', brandMode: 'both', logoSize: 64, logoPlate: false, background: 'theme', backgroundColor: '#17142b', backgroundImage: '', backgroundShield: 75, titleFont: 'theme', bodyFont: 'theme', titleScale: 100, bodyScale: 100 };
export const initialCarouselSlides: Omit<CarouselSlide, 'id'>[] = [
  { layout: 'cover', kicker: 'MINIPORADNIK', title: 'Pomysł, który warto pokazać', body: 'Zamień swoją wiedzę w karuzelę, którą chce się czytać. Przesuń dalej →', image: '' },
  { layout: 'content', kicker: 'KROK PIERWSZY', title: 'Jedna myśl na slajd', body: 'Wybierz najważniejszą wskazówkę. Wyjaśnij ją prostym językiem i dodaj przykład, który pomoże odbiorcy działać.', image: '' },
  { layout: 'content', kicker: 'KROK DRUGI', title: 'Pokaż to na przykładzie', body: 'Dodaj własne zdjęcie lub ilustrację. Niech obraz wspiera przekaz i przyciąga uwagę do tego, co najważniejsze.', image: '' },
  { layout: 'quote', kicker: 'ZAPAMIĘTAJ', title: 'Małe kroki robią różnicę', body: 'Dobry pomysł staje się wartościowy, kiedy wprowadzisz go w życie.', image: '' },
  { layout: 'cover', kicker: 'TWÓJ KOLEJNY KROK', title: 'Zapisz na później', body: 'Podziel się karuzelą z osobą, której przyda się ta wskazówka. Więcej pomysłów znajdziesz na moim profilu.', image: '' },
];

export function wrapDesignText(text: string, width: number, measure: (value: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && measure(`${line} ${word}`) <= width) { line += ` ${word}`; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of Array.from(word)) {
        if (line && measure(line + char) > width) { lines.push(line); line = ''; }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function fitDesignText(text: string, width: number, height: number, desired: number, minimum: number, measure: (text: string, size: number) => number) {
  let size = desired;
  let lines: string[] = [];
  while (size >= minimum) {
    lines = wrapDesignText(text, width, value => measure(value, size));
    if (lines.length * size * 1.22 <= height) return { lines, size, fits: true };
    size -= 2;
  }
  return { lines, size: minimum, fits: false };
}

export type CarouselAssets = { logo?: HTMLImageElement | null; background?: HTMLImageElement | null; hideStickers?: boolean; stickerTime?: number; stickerImages?: StickerImages; renderLayer?: 'background' | 'foreground' };
const validColor = (color: string | undefined, fallback: string) => color && /^#[\da-f]{6}$/i.test(color) ? color : fallback;

export function carouselSlideDesign(design: CarouselDesign, tone?: CarouselTone): CarouselDesign {
  if (!tone || tone === 'theme') return design;
  const theme = CAROUSEL_THEMES.find(item => item.id === design.theme) || CAROUSEL_THEMES[0];
  const accent = validColor(design.accent, theme.accent);
  return { ...design, background: 'solid', backgroundColor: tone === 'light' ? '#f8f5ef' : tone === 'dark' ? '#101114' : accent, accent: tone === 'accent' ? carouselContrast(accent) : accent };
}

function carouselBackdrop(context: CanvasRenderingContext2D, width: number, height: number, design: CarouselDesign, assets: CarouselAssets) {
  const theme = CAROUSEL_THEMES.find(item => item.id === design.theme) || CAROUSEL_THEMES[0];
  const accent = validColor(design.accent, theme.accent), base = validColor(design.backgroundColor, theme.background);
  let kind = design.background || 'theme';
  if (kind === 'theme') kind = ({ newspaper: 'paper', clay: 'depth', glass: 'mesh', editorial: 'editorial', retro: 'retro', blueprint: 'grid' })[theme.id] || 'orb';
  const solidLight = kind === 'solid' && (Number.parseInt(base.slice(1, 3), 16) * 0.299 + Number.parseInt(base.slice(3, 5), 16) * 0.587 + Number.parseInt(base.slice(5, 7), 16) * 0.114) > 150;
  if (assets.renderLayer === 'foreground') return { theme, accent, kind, solidLight };
  context.fillStyle = kind === 'solid' ? base : theme.background; context.fillRect(0, 0, width, height);
  if (kind === 'gradient' || kind === 'mesh') {
    const gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, theme.background); gradient.addColorStop(1, accent);
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    if (kind === 'mesh') {
      for (const [x, y, radius, color] of [[1050, 150, 600, '#f472b6'], [40, height - 30, 580, '#67e8f9']] as const) {
        const glow = context.createRadialGradient(x, y, 0, x, y, radius); glow.addColorStop(0, color); glow.addColorStop(1, `${color}00`);
        context.globalAlpha = 0.5; context.fillStyle = glow; context.fillRect(0, 0, width, height); context.globalAlpha = 1;
      }
    }
  }
  if (kind === 'grid' || kind === 'dots') {
    context.save(); context.strokeStyle = accent; context.fillStyle = accent; context.globalAlpha = 0.17; context.lineWidth = 1;
    if (kind === 'grid') { context.beginPath(); for (let x = 0; x <= width; x += 54) { context.moveTo(x, 0); context.lineTo(x, height); } for (let y = 0; y <= height; y += 54) { context.moveTo(0, y); context.lineTo(width, y); } context.stroke(); }
    else for (let y = 20; y < height; y += 42) for (let x = 20; x < width; x += 42) { context.beginPath(); context.arc(x, y, 2, 0, Math.PI * 2); context.fill(); }
    context.restore();
  }
  if (kind === 'paper') {
    context.fillStyle = '#f2eadb'; context.fillRect(0, 0, width, height);
    let seed = 28;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    context.save(); context.fillStyle = '#4c3a24'; context.globalAlpha = 0.075;
    for (let i = 0; i < 14000; i++) context.fillRect(random() * width, random() * height, 1 + random(), 1);
    context.restore();
  }
  if (kind === 'depth') {
    for (const [x, y, radius, color] of [[width - 120, 210, 240, accent], [60, height - 60, 210, '#eab9ea']] as const) {
      const sphere = context.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.04, x, y, radius);
      sphere.addColorStop(0, '#ffffff'); sphere.addColorStop(0.3, `${color}99`); sphere.addColorStop(1, color);
      context.save(); context.shadowColor = '#34235240'; context.shadowBlur = 45; context.shadowOffsetY = 28; context.fillStyle = sphere;
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.restore();
    }
  }
  if (kind === 'editorial') { context.fillStyle = accent; context.fillRect(0, 0, 26, height); context.globalAlpha = 0.1; context.fillRect(730, 0, 350, height); context.globalAlpha = 1; }
  if (kind === 'retro') {
    context.save(); context.strokeStyle = accent; context.lineWidth = 28; context.globalAlpha = 0.25;
    for (let i = 0; i < 4; i++) { context.beginPath(); context.arc(width + 40, height - 170, 170 + i * 64, Math.PI / 2, Math.PI * 1.5); context.stroke(); } context.restore();
  }
  if (kind === 'orb') { context.fillStyle = accent; context.globalAlpha = 0.12; context.beginPath(); context.arc(width - 40, 70, 340, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1; }
  if (kind === 'photo' && assets.background) {
    const rect = fitImageRect(assets.background.naturalWidth, assets.background.naturalHeight, width, height, 'cover');
    context.drawImage(assets.background, rect.x, rect.y, rect.width, rect.height);
    context.save(); context.globalAlpha = Math.max(0, Math.min(95, design.backgroundShield ?? 75)) / 100;
    context.fillStyle = theme.background; context.fillRect(0, 0, width, height); context.restore();
  }
  if ((theme.id === 'clay' || theme.id === 'glass') && kind !== 'solid') {
    context.save(); context.shadowBlur = 40; context.shadowColor = '#21183d35'; context.shadowOffsetY = 20;
    context.fillStyle = `${theme.background}${theme.id === 'glass' ? 'eb' : 'ed'}`;
    context.beginPath(); context.roundRect(48, 146, width - 96, height - 285, theme.id === 'glass' ? 30 : 44); context.fill();
    context.shadowBlur = 0; context.strokeStyle = '#ffffff77'; context.lineWidth = 2; context.stroke(); context.restore();
  }
  return { theme, accent, kind, solidLight };
}

export function carouselBrandPlacement(design: CarouselDesign, logoWidth: number, logoHeight: number) {
  const showLogo = Boolean(design.logo && design.brandMode !== 'text' && logoWidth > 0 && logoHeight > 0);
  const height = Math.max(32, Math.min(90, design.logoSize || 64));
  const fit = showLogo ? fitImageRect(logoWidth, logoHeight, 220, height, 'contain') : { width: 0, height: 0 };
  return { showLogo, width: fit.width, height: fit.height, showText: design.brandMode !== 'logo' || !showLogo, textX: 82 + (showLogo ? fit.width + 22 : 0) };
}

export function renderCarouselSlide(canvas: HTMLCanvasElement, slide: CarouselSlide, inputDesign: CarouselDesign, index: number, count: number, image?: HTMLImageElement | null, assets: CarouselAssets = {}): { fits: boolean; width: number; height: number; textBoxes: CarouselTextBox[] } {
  const design = carouselSlideDesign(inputDesign, slide.tone);
  const width = 1080, height = design.format === 'square' ? 1080 : 1350;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Brak obsługi grafiki w przeglądarce.');
  const { theme, accent, kind, solidLight } = carouselBackdrop(context, width, height, design, assets);
  const textBoxes: CarouselTextBox[] = [];
  if (assets.renderLayer === 'background') return { fits: true, width, height, textBoxes };
  // Use the same transparent foreground composition as the live editor, including
  // antialiasing and overlapping translucent markers/backgrounds.
  if (!assets.renderLayer) {
    const foregroundCanvas = document.createElement('canvas');
    const result = renderCarouselSlide(foregroundCanvas, slide, inputDesign, index, count, image, { ...assets, hideStickers: true, renderLayer: 'foreground' });
    if (!assets.hideStickers) drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer === 'back'), width, height, assets.stickerTime || 0, assets.stickerImages);
    context.drawImage(foregroundCanvas, 0, 0);
    if (!assets.hideStickers) drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer !== 'back'), width, height, assets.stickerTime || 0, assets.stickerImages);
    return result;
  }
  if (assets.renderLayer === 'foreground') context.clearRect(0, 0, width, height);
  if (!assets.hideStickers) drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer === 'back'), width, height, assets.stickerTime || 0, assets.stickerImages);
  const newspaper = theme.id === 'newspaper', editorial = theme.id === 'editorial';
  const serif = newspaper || editorial || theme.id === 'retro';
  const family = serif ? 'Georgia' : 'Arial';
  const foreground = kind === 'paper' ? '#28251f' : kind === 'solid' ? (solidLight ? '#171a25' : '#ffffff') : theme.foreground;
  const muted = slide.tone === 'accent' ? foreground : kind === 'paper' ? '#565044' : kind === 'solid' ? (solidLight ? '#475569' : '#d8deeb') : theme.muted;
  const padding = 82, textWidth = width - padding * 2;
  const brand = carouselBrandPlacement(design, assets.logo?.naturalWidth || 0, assets.logo?.naturalHeight || 0);
  if (brand.showLogo && assets.logo) {
    const y = 82 - brand.height / 2;
    if (design.logoPlate) { context.fillStyle = '#ffffff'; context.beginPath(); context.roundRect(padding - 10, y - 8, brand.width + 20, brand.height + 16, 12); context.fill(); }
    context.drawImage(assets.logo, padding, y, brand.width, brand.height);
  }
  if (brand.showText) {
    let fontSize = newspaper ? 32 : 25;
    const available = 825 - brand.textX;
    while (fontSize > 14) { context.font = `600 ${fontSize}px ${family}`; if (context.measureText(design.brand.slice(0, 42)).width <= available) break; fontSize--; }
    context.fillStyle = foreground; context.fillText(design.brand.slice(0, 42), brand.textX, 91, available);
  }
  if (!design.navigation) { context.font = '600 24px Arial'; context.fillStyle = muted; context.textAlign = 'right'; context.fillText(`${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`, width - padding, 91); context.textAlign = 'left'; }
  if (newspaper) {
    context.strokeStyle = foreground; context.lineWidth = 3; context.beginPath(); context.moveTo(padding, 139); context.lineTo(width - padding, 139); context.stroke();
    context.lineWidth = 1; context.beginPath(); context.moveTo(padding, 147); context.lineTo(width - padding, 147); context.stroke();
  }
  const hasImage = Boolean(image && slide.image);
  const composition = slide.composition, ending = composition?.startsWith('ending-');
  if (composition === 'cover-bold') { context.fillStyle = accent; context.fillRect(padding, 232, 12, hasImage ? 390 : 520); }
  if (composition === 'ending-card') { context.save(); context.fillStyle = accent; context.globalAlpha = .12; context.beginPath(); context.roundRect(56, 158, width - 112, height - 310, 42); context.fill(); context.restore(); }
  const creator = composition?.startsWith('creator-') || composition === 'ending-creator';
  if (hasImage && image && !creator) {
    const y = ending ? height - 460 : slide.layout === 'quote' ? 820 : 750, boxHeight = ending ? 160 : height - y - 162;
    drawCarouselImage(context, image, padding, y, textWidth, boxHeight, slide.imageFrame || (newspaper ? 'rectangle' : 'rounded'), newspaper);
  }
  let fits = true;
  const text = (field: CarouselTextField, x: number, y: number, boxWidth: number, boxHeight: number, desired: number, minimum: number, bold: boolean, color: string, columns = 1) => {
    if (!slide[field]) return 0;
    const centered = composition && ['cover-center', 'ending-card', 'ending-minimal', 'ending-creator'].includes(composition);
    const presetFrame: CarouselTextFrame = {
      ...(centered ? { width: 80, align: 'center' as const } : {}),
      ...(composition === 'cover-marker' && field === 'title' ? { fill: accent, padding: 20, radius: 18 } : {}),
    };
    const frame = { ...presetFrame, ...slide.textFrames?.[field] };
    const font = field === 'kicker' ? (newspaper ? 'Georgia' : 'Arial') : carouselFont(field === 'title' ? design.titleFont : design.bodyFont, family);
    const scale = (field === 'kicker' ? 1 : Math.max(80, Math.min(140, (field === 'title' ? design.titleScale : design.bodyScale) || 100)) / 100) * (frame.scale ?? 100) / 100;
    const frameWidth = frame.width === undefined ? boxWidth : width * frame.width / 100;
    const frameHeight = slide.textFrames?.[field]?.scale !== undefined || slide.textFrames?.[field]?.width !== undefined ? height - 160 : boxHeight;
    const block = drawRichText(context, slide[field], slide[`${field}Marks`] || [], x + (boxWidth - frameWidth) / 2, y, frameWidth, frameHeight, desired * scale, minimum * (frame.scale ?? 100) / 100, font, bold, composition === 'cover-marker' && field === 'title' ? carouselContrast(accent) : color, columns, 54, frame, { width, height });
    textBoxes.push({ ...block.bounds, field, runs: block.hits, fontSize: block.size });
    fits &&= block.fits;
    return block.usedHeight;
  };
  text('kicker', padding, 179, textWidth, 60, 23, 16, true, creator && solidLight && carouselContrast(accent) === '#172033' ? foreground : kind === 'paper' ? '#9e3529' : accent);
  if (creator) {
    renderCreatorComposition({ context, slide, composition: composition!, width, height, index, image: hasImage ? image : null, foreground, muted, accent, text });
  } else if (composition) {
    const titleY = 260, titleHeight = ending ? 210 : hasImage ? 235 : 360;
    const used = text('title', composition === 'cover-bold' ? 116 : padding, titleY, composition === 'cover-bold' ? textWidth - 34 : textWidth, titleHeight, composition === 'cover-bold' ? 104 : ending ? 78 : 90, 32, true, foreground);
    const bodyY = Math.max(titleY + used + 48, ending ? height * .42 : hasImage ? 530 : 650);
    const bodyBottom = ending ? (hasImage ? height - 485 : height - 300) : hasImage ? 700 : height - 200;
    text('body', padding, bodyY, textWidth, Math.max(70, bodyBottom - bodyY), 38, 24, false, muted);
  } else if (slide.layout === 'quote') {
    context.fillStyle = kind === 'paper' ? '#9e3529' : accent; context.font = 'bold 175px Georgia'; context.fillText('“', padding - 8, 365);
    text('body', padding, 350, textWidth, hasImage ? 310 : height - 640, 58, 28, true, foreground);
    text('title', padding, hasImage ? 705 : height - 240, textWidth, 85, 30, 22, false, muted);
  } else {
    const titleHeight = hasImage ? 235 : 345;
    const used = text('title', padding, 258, textWidth, titleHeight, slide.layout === 'cover' ? (newspaper ? 88 : 84) : 70, 32, true, foreground);
    const bodyY = hasImage ? 530 : Math.max(258 + used + 62, newspaper ? 520 : 580);
    const bodyHeight = hasImage ? 170 : height - bodyY - 170;
    if (newspaper && slide.layout === 'content') {
      context.strokeStyle = '#746c5e'; context.lineWidth = 1; context.beginPath(); context.moveTo(width / 2, bodyY); context.lineTo(width / 2, bodyY + bodyHeight); context.stroke();
      text('body', padding, bodyY, textWidth, bodyHeight, 42, 24, false, muted, 2);
    } else text('body', padding, bodyY, textWidth, bodyHeight, 39, 24, false, muted);
    if (newspaper) { context.strokeStyle = foreground; context.lineWidth = 1; context.beginPath(); context.moveTo(padding, bodyY - 25); context.lineTo(width - padding, bodyY - 25); context.stroke(); }
  }
  if (slide.cta?.text) {
    const cta = slide.cta, color = validColor(cta.color, accent), w = Math.min(800, textWidth), h = 108, x = (width - w) / 2, y = height - 255;
    context.save(); context.lineWidth = 4; context.strokeStyle = color; context.fillStyle = color; context.beginPath(); context.roundRect(x, y, w, h, cta.style === 'pill' ? h / 2 : 18);
    if (cta.style === 'outline') context.stroke(); else context.fill();
    context.fillStyle = cta.style === 'outline' ? color : carouselContrast(color); context.textAlign = 'center'; context.textBaseline = 'middle';
    let size = 36; do { context.font = `700 ${size}px Arial`; if (context.measureText(cta.text).width <= w - 64) break; size--; } while (size > 20);
    context.fillText(cta.text, width / 2, y + h / 2, w - 64); context.restore();
  }
  if (design.navigation) drawCarouselNavigation(context, design.navigation, index, count, width, height, muted, accent);
  else {
    context.fillStyle = newspaper ? foreground : accent; context.fillRect(padding, height - 105, textWidth, newspaper ? 2 : 3);
    context.font = `500 22px ${family}`; context.fillStyle = muted;
    context.fillText(index === count - 1 ? 'Zapisz • Udostępnij • Wróć po więcej' : 'Przesuń dalej', padding, height - 57);
    if (index < count - 1) { context.font = '32px Arial'; context.textAlign = 'right'; context.fillText('→', width - padding, height - 55); }
  }
  if (!assets.hideStickers) drawSlideStickers(context, slide.stickers?.filter(sticker => sticker.layer !== 'back'), width, height, assets.stickerTime || 0, assets.stickerImages);
  return { fits, width, height, textBoxes };
}

