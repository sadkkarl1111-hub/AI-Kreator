import type { AdResearchExample } from './adResearch.js';
export class MetaLibraryError extends Error { constructor(message: string, public status = 502) { super(message); } }
export const META_RESEARCH_COUNTRIES = ['PL','DE','FR','ES','IT','NL','CZ','SK','AT','BE','SE','DK','FI','IE','PT','RO','HU','LT','LV','EE','BG','HR','SI','GR','CY','LU','MT','GB'] as const;
export function metaLibraryConfigured(token: string, version: string) { return Boolean(token.trim() && /^v\d{2}\.\d+$/.test(version)); }
export function readMetaSearch(body: Record<string, unknown>) {
  const query = typeof body.query === 'string' ? body.query.trim() : '', country = body.country ?? 'PL', pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
  if (query.length > 120 || (!pageId && query.length < 2)) throw new MetaLibraryError('Wpisz branżę lub nazwę firmy (2–120 znaków) albo ID strony.',400);
  if (!META_RESEARCH_COUNTRIES.includes(country as typeof META_RESEARCH_COUNTRIES[number])) throw new MetaLibraryError('Wybierz kraj obsługiwany przez integrację.',400);
  if (pageId && !/^\d{3,30}$/.test(pageId)) throw new MetaLibraryError('ID strony Facebooka powinno zawierać tylko cyfry.',400);
  return { query, country: String(country), pageId };
}
export async function searchMetaAds(input: ReturnType<typeof readMetaSearch>, token: string, version: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<{ ads: (AdResearchExample & { platforms: string[]; stopDate?: string })[]; limited: boolean }> {
  if (!metaLibraryConfigured(token,version)) throw new MetaLibraryError('Automatyczne wyszukiwanie Meta czeka na konfigurację tokenu i wersji API. Możesz wkleić teksty reklam poniżej.',503);
  const url = new URL(`https://graph.facebook.com/${version}/ads_archive`);
  url.searchParams.set('ad_type','ALL'); url.searchParams.set('ad_active_status','ACTIVE'); url.searchParams.set('ad_reached_countries',JSON.stringify([input.country])); url.searchParams.set('limit','20');
  url.searchParams.set('fields','id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms');
  if (input.pageId) url.searchParams.set('search_page_ids',JSON.stringify([input.pageId])); else url.searchParams.set('search_terms',input.query);
  const response = await request(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([signal,AbortSignal.timeout(20000)]), redirect: 'error' });
  if (!response.ok) { if ([400,401,403].includes(response.status)) throw new MetaLibraryError('Meta odrzuciła dostęp lub parametry wyszukiwania. Administrator musi sprawdzić token, uprawnienia Ad Library i wersję Graph API.',502); if (response.status===429) throw new MetaLibraryError('Limit wyszukiwania Meta. Spróbuj ponownie za kilka minut.',429); throw new MetaLibraryError('Biblioteka Meta jest chwilowo niedostępna. Spróbuj ponownie.'); }
  const data = await response.json() as { data?: Record<string,unknown>[]; paging?: { next?: string }; error?: unknown };
  if (!Array.isArray(data.data) || data.error) throw new MetaLibraryError('Niepoprawna odpowiedź Biblioteki Meta.');
  const text = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0,max) : '';
  const date = (v: unknown) => typeof v==='string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0,10) : undefined;
  const ads = data.data.slice(0,20).flatMap(row => {
    const id = text(row.id,80); if (!/^\d+$/.test(id)) return [];
    const copy = [...(Array.isArray(row.ad_creative_link_titles)?row.ad_creative_link_titles:[]),...(Array.isArray(row.ad_creative_bodies)?row.ad_creative_bodies:[])].filter(v=>typeof v==='string').join('\n').slice(0,2000);
    if (!copy.trim()) return [];
    return [{ id, pageName: text(row.page_name,120), text: copy, url: `https://www.facebook.com/ads/library/?id=${id}`, startDate: date(row.ad_delivery_start_time), stopDate: date(row.ad_delivery_stop_time), platforms: Array.isArray(row.publisher_platforms)?row.publisher_platforms.filter((v):v is string=>typeof v==='string').map(v=>v.slice(0,30)).slice(0,6):[], source:'meta' as const }];
  });
  // Never return provider paging/snapshot URLs: those may contain the secret token.
  return { ads, limited: Boolean(data.paging?.next) };
}
