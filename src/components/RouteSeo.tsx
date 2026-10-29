import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_IMAGE, getSeoPage, seoStructuredData, SITE_NAME, SITE_URL } from '@/lib/seo';

export function applyRouteSeo(pathname: string) {
  const entry = getSeoPage(pathname);
  const title = entry?.title || `Panel użytkownika | ${SITE_NAME}`;
  const description = entry?.description || 'Konto i narzędzia użytkownika Kreatora Grafik AI.';
  document.title = title;
  const meta = (attribute: 'name' | 'property', key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = content;
  };
  meta('name', 'description', description);
  meta('name', 'robots', entry ? 'index, follow, max-image-preview:large' : 'noindex, follow');
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('property', 'og:type', entry?.article ? 'article' : 'website');
  meta('property', 'og:image', `${SITE_URL}${entry?.image || DEFAULT_IMAGE}`);
  meta('property', 'og:site_name', SITE_NAME);
  meta('property', 'og:locale', 'pl_PL');
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', title);
  meta('name', 'twitter:description', description);
  meta('name', 'twitter:image', `${SITE_URL}${entry?.image || DEFAULT_IMAGE}`);

  document.querySelectorAll('link[rel="canonical"], script[data-route-seo]').forEach((element) => element.remove());
  if (entry) {
    const url = `${SITE_URL}${entry.path}`;
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = url;
    document.head.appendChild(canonical);
    meta('property', 'og:url', url);
    const schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.dataset.routeSeo = '';
    schema.textContent = JSON.stringify(seoStructuredData(entry));
    document.head.appendChild(schema);
  } else {
    document.head.querySelector('meta[property="og:url"]')?.remove();
  }
}

export function RouteSeo() {
  const { pathname } = useLocation();
  useLayoutEffect(() => applyRouteSeo(pathname), [pathname]);
  return null;
}
