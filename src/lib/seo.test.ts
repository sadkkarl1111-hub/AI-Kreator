import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyRouteSeo } from '../components/RouteSeo';
import { getSeoPage, PRIVATE_PATHS, PUBLIC_SEO_PAGES, SEO_ALIASES, seoStructuredData } from './seo';
import { renderApacheRoutes, renderInitialContent, renderSeoHead, renderSitemap } from '../../scripts/generate-seo';

describe('public indexing boundaries', () => {
  it('includes every guest route and article, and excludes every protected route', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    for (const match of source.matchAll(/<Route path="([^"]+)" element=\{([^\n]+)\}/g)) {
      const [, route, element] = match;
      if (route.includes(':') || route === '*') continue;
      if (element.includes('<ProtectedRoute>') || element.includes('<AdminOnlyRoute>')) {
        expect(getSeoPage(route), route).toBeUndefined();
        expect(PRIVATE_PATHS, route).toContain(route);
      } else if (!element.includes('<Navigate') && !PRIVATE_PATHS.includes(route)) {
        expect(getSeoPage(route), route).toBeDefined();
      }
    }
    const sitemap = new DOMParser().parseFromString(renderSitemap(), 'application/xml');
    expect(sitemap.querySelector('parsererror')).toBeNull();
    expect(sitemap.querySelectorAll('url')).toHaveLength(PUBLIC_SEO_PAGES.length);
    for (const route of PRIVATE_PATHS) expect(getSeoPage(route), route).toBeUndefined();
    for (const alias of Object.keys(SEO_ALIASES)) expect(renderSitemap()).not.toContain(`<loc>https://ai-kreator.pl${alias}</loc>`);
    expect(new Set(PUBLIC_SEO_PAGES.map((entry) => entry.path)).size).toBe(PUBLIC_SEO_PAGES.length);
  });

  it('renders one unique canonical and title for each public page before JavaScript', () => {
    for (const entry of PUBLIC_SEO_PAGES) {
      const html = new DOMParser().parseFromString(`<html><head>${renderSeoHead(entry)}</head></html>`, 'text/html');
      expect(html.title).toBe(entry.title);
      expect(html.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
      expect(html.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`https://ai-kreator.pl${entry.path}`);
      expect(html.querySelector('meta[name="robots"]')?.getAttribute('content')).not.toContain('noindex');
      expect(JSON.parse(html.querySelector('script')!.textContent!)).toEqual(seoStructuredData(entry));
    }
    expect(new Set(PUBLIC_SEO_PAGES.map((entry) => entry.title)).size).toBe(PUBLIC_SEO_PAGES.length);
  });

  it('makes private HTML noindex with no public canonical or structured data', () => {
    const head = new DOMParser().parseFromString(`<head>${renderSeoHead()}</head>`, 'text/html');
    expect(head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
    expect(head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(head.querySelector('script')).toBeNull();
  });

  it('includes real article sections, tables and crawlable links in initial HTML', () => {
    const entry = PUBLIC_SEO_PAGES.find((entry) => entry.article)!;
    const html = new DOMParser().parseFromString(renderInitialContent(entry), 'text/html');
    expect(html.querySelector('h1')?.textContent).toBe(entry.article!.title);
    expect(html.querySelectorAll('h2').length).toBeGreaterThanOrEqual(entry.article!.sections.length);
    expect(html.querySelectorAll('table').length).toBeGreaterThan(0);
    expect(html.querySelectorAll('a[href^="/blog/"]').length).toBeGreaterThan(0);
    expect(html.body.textContent).toContain(entry.article!.intro[0]);
  });

  it('escapes text in head and body instead of creating executable markup', () => {
    const entry = { ...PUBLIC_SEO_PAGES[0], title: '<script>bad()</script>', heading: '<img onerror="bad()">', description: 'A & B "test" </script>' };
    const html = new DOMParser().parseFromString(`<head>${renderSeoHead(entry)}</head><body>${renderInitialContent(entry)}</body>`, 'text/html');
    expect(html.querySelector('img')).toBeNull();
    expect(html.querySelectorAll('script')).toHaveLength(1);
    expect(JSON.parse(html.querySelector('script')!.textContent!)['@graph'][2].description).toBe(entry.description);
  });

  it('generates internal routes, legal redirects, private noindex shell and real 404 rules', () => {
    const apache = renderApacheRoutes();
    expect(apache).toContain('RewriteRule ^tools/carousel$ /_seo/tools/carousel.html [END]');
    expect(apache).toContain('RewriteRule ^terms/?$ /regulamin [R=301,END,NE]');
    expect(apache).toContain('shared/[^/]+');
    expect(apache).toContain('RewriteRule ^ - [R=404,END]');
    expect(apache).not.toContain('/index.html [L]');
  });
});

describe('metadata after client navigation', () => {
  it('updates public → private → public without leaking canonicals or noindex', () => {
    document.head.innerHTML = '<meta name="google-site-verification" content="preserve-me">';
    applyRouteSeo('/tools/carousel');
    expect(document.title).toContain('karuzel');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://ai-kreator.pl/tools/carousel');
    applyRouteSeo('/admin');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[data-route-seo]')).toBeNull();
    applyRouteSeo('/blog');
    applyRouteSeo('/blog');
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelectorAll('script[data-route-seo]')).toHaveLength(1);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).not.toContain('noindex');
    expect(document.querySelector('meta[name="google-site-verification"]')?.getAttribute('content')).toBe('preserve-me');
  });

  it('canonicalizes legal aliases, trailing slashes and rejects unknown pages', () => {
    applyRouteSeo('/terms/');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://ai-kreator.pl/regulamin');
    applyRouteSeo('/blog/nonexistent');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
  });
});
