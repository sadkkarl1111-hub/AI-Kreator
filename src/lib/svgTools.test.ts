import { describe, expect, it } from 'vitest';
import { DEFAULT_SVG_OPTIONS, SVG_STYLES, generateSvg, serializeIconSvg } from './svgTools';
import { SVG_ICONS, filterSvgIcons } from './svgCatalog';

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('standalone SVG exports', () => {
  it.each(SVG_STYLES)('exports valid vector artwork for $name', style => {
    const svg = generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id });
    const document = parse(svg);
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(document.querySelector('path, circle, polygon, pattern, rect')).not.toBeNull();
    expect(document.querySelector('script, image, foreignObject')).toBeNull();
    expect(svg).toBe(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id }));
  });

  it.each(SVG_STYLES)('creates a new variant of $name', style => {
    expect(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id, seed: 54321 }))
      .not.toBe(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: style.id, seed: 1 }));
  });

  it('escapes captions and rejects injected attributes', () => {
    const document = parse(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: 'sticker', text: '<script>alert(1)</script>&"', primary: 'red" onload="evil()' }));
    expect(document.querySelector('parsererror, script, [onload]')).toBeNull();
    expect(document.querySelector('text')?.textContent).toBe('<script>alert(1)</script>&"');
    expect(document.querySelector('polygon')?.getAttribute('fill')).toBe('#a855f7');
  });

  it('preserves output dimensions and removes the background for transparency', () => {
    const document = parse(generateSvg({ ...DEFAULT_SVG_OPTIONS, style: 'rocket', width: 1080, height: 1920, transparent: true }));
    expect(document.documentElement.getAttribute('width')).toBe('1080');
    expect(document.documentElement.getAttribute('height')).toBe('1920');
    expect(document.querySelector('rect[width="1200"]')).toBeNull();
    const bounded = parse(generateSvg({ ...DEFAULT_SVG_OPTIONS, width: NaN, height: 999999 }));
    expect(bounded.documentElement.getAttribute('width')).toBe('1200');
    expect(bounded.documentElement.getAttribute('height')).toBe('4096');
  });

  it('exports icon styling, accessible title and both license notices', () => {
    const element = parse('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" stroke="#112233" stroke-width="3" fill="none" class="text-primary" aria-hidden="true"><path d="M1 1L10 10"/></svg>').documentElement as unknown as SVGSVGElement;
    const document = parse(serializeIconSvg(element, 'Serce', 512));
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('width')).toBe('512');
    expect(document.documentElement.getAttribute('stroke')).toBe('#112233');
    expect(document.documentElement.getAttribute('stroke-width')).toBe('3');
    expect(document.documentElement.hasAttribute('class')).toBe(false);
    expect(document.querySelector('title')?.textContent).toBe('Serce');
    expect(document.querySelector('metadata')?.textContent).toContain('Lucide Icons and Contributors');
    expect(document.querySelector('metadata')?.textContent).toContain('Cole Bemis');
    expect(element.getAttribute('width')).toBe('48');
  });
});

it('finds icons with Polish keywords, without diacritics and within a category', () => {
  expect(filterSvgIcons('strzalka prawo', 'all').map(icon => icon.id)).toContain('arrow-right');
  expect(filterSvgIcons('wysylka', 'all').map(icon => icon.id)).toContain('truck');
  expect(filterSvgIcons('serce', 'Firma i zaufanie')).toEqual([]);
  expect(new Set(SVG_ICONS.map(icon => icon.id)).size).toBe(SVG_ICONS.length);
});
