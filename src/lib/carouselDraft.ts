import type { CarouselDocument } from './carouselHistory';
const JOURNAL_KEY = 'kreator-carousel-recovery-v1';
export type PreparedDraft = { journal: string; assets: Map<string, string> };
let database: Promise<IDBDatabase> | undefined, connection: IDBDatabase | undefined, lastTime = 0;
const assetKeys = new Map<string, string>();
function assetKey(source: string) {
  const previous = assetKeys.get(source); if (previous) return previous;
  let a = 2166136261, b = 5381;
  for (let index = 0; index < source.length; index++) { a = Math.imul(a ^ source.charCodeAt(index), 16777619); b = Math.imul(b, 33) ^ source.charCodeAt(index); }
  const key = `${source.length}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
  assetKeys.set(source, key); if (assetKeys.size > 100) assetKeys.delete(assetKeys.keys().next().value!); return key;
}
export function prepareCarouselDraft(project: CarouselDocument): PreparedDraft {
  const assets = new Map<string, string>(); let imageLength = 0;
  lastTime = Math.max(Date.now(), lastTime + 1);
  const journal = JSON.stringify({ draftVersion: 1, updated: lastTime, project: { version: 1, ...project } }, (_key, value) => {
    if (typeof value !== 'string' || !/^data:image\//.test(value)) return value;
    const key = assetKey(value); assets.set(key, value); imageLength += value.length; return { carouselAsset: key };
  });
  if (journal.length + imageLength > 24_000_000) throw new Error('Projekt jest za duży do automatycznego zapisu.');
  return { journal, assets };
}
export function writeCarouselRecovery(journal: string) {
  // A small synchronous checkpoint survives reloads while media stay in IndexedDB.
  try { localStorage.setItem(JOURNAL_KEY, journal); } catch { /* Use the database checkpoint. */ }
}
function openDraftDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('kreator-carousel-local', 2);
    request.onupgradeneeded = () => { for (const name of ['drafts', 'assets']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
    request.onsuccess = () => { connection = request.result; request.result.onversionchange = () => { request.result.close(); database = undefined; connection = undefined; }; resolve(request.result); };
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error('Baza projektu jest zablokowana.')); };
  });
  return database;
}
function getValue(db: IDBDatabase, store: string, key: string) {
  return new Promise<unknown>((resolve, reject) => { const request = db.transaction(store).objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function resolveDraft(source: string, db: IDBDatabase) {
  const envelope = JSON.parse(source);
  if (envelope.version === 1 && envelope.slides) return source;
  if (envelope.draftVersion !== 1 || !envelope.project || !Number.isFinite(envelope.updated)) throw new Error('Niepoprawny zapis projektu.');
  const references = new Set<string>();
  JSON.stringify(envelope.project, (_key, value) => { if (value && typeof value === 'object' && typeof value.carouselAsset === 'string') references.add(value.carouselAsset); return value; });
  const assets = new Map<string, string>();
  for (const key of references) { const value = await getValue(db, 'assets', key); if (typeof value !== 'string') throw new Error('Zapis obrazu nie został zakończony.'); assets.set(key, value); }
  return JSON.stringify(envelope.project, (_key, value) => value && typeof value === 'object' && typeof value.carouselAsset === 'string' ? assets.get(value.carouselAsset) : value);
}
export async function readCarouselDraft(): Promise<string | null> {
  const db = await openDraftDatabase();
  const stored = await getValue(db, 'drafts', 'current'); let recovery: string | null = null;
  try { recovery = localStorage.getItem(JOURNAL_KEY); } catch { /* Use the database checkpoint. */ }
  const sources = [recovery, stored].filter((value): value is string => typeof value === 'string');
  const date = (source: string) => { try { return Number(JSON.parse(source).updated) || 0; } catch { return 0; } };
  sources.sort((a, b) => date(b) - date(a));
  for (const source of sources) { lastTime = Math.max(lastTime, date(source)); try { return await resolveDraft(source, db); } catch { /* Try the last completed checkpoint if a new image was still saving. */ } }
  if (sources.length) throw new Error('Nie udało się odczytać projektu.');
  return null;
}
function putDraft(db: IDBDatabase, draft: PreparedDraft) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['drafts', 'assets'], 'readwrite'), images = transaction.objectStore('assets');
    transaction.objectStore('drafts').put(draft.journal, 'current');
    const keys = images.getAllKeys();
    keys.onsuccess = () => {
      const existing = new Set(keys.result);
      for (const [key, source] of draft.assets) if (!existing.has(key)) images.put(source, key);
    };
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
export function writeCarouselDraft(draft: PreparedDraft): Promise<void> {
  return connection ? putDraft(connection, draft) : openDraftDatabase().then(db => putDraft(db, draft));
}
export async function pruneCarouselDraftAssets(project: CarouselDocument) {
  const required = prepareCarouselDraft(project).assets, db = await openDraftDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('assets', 'readwrite'), store = transaction.objectStore('assets'), keys = store.getAllKeys();
    keys.onsuccess = () => { for (const key of keys.result) if (!required.has(String(key))) store.delete(key); };
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  });
}
