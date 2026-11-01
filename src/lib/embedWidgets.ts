import runtime from './embedWidgetRuntime.js?raw';

export type WidgetKind = 'countdown' | 'seats' | 'progress';
export type WidgetSource = 'manual' | 'daily' | 'steps' | 'url';
export type WidgetTheme = 'light' | 'dark' | 'neon' | 'ticket';
export type WidgetStep = { date: string; value: number };
export type WidgetSettings = {
  kind: WidgetKind; theme: WidgetTheme; title: string; subtitle: string; finishText: string;
  zone: string; deadline: string; start: string; occurrence: 'earlier' | 'later';
  source: WidgetSource; total: number; value: number; delta: number; steps: WidgetStep[];
  progressMode: 'value' | 'time'; endpoint: string; accent: string; background: string; foreground: string;
  animated: boolean; radius: number; showDetails: boolean;
};
export const WIDGET_ZONES = ['Europe/Warsaw', 'UTC', 'Europe/London', 'America/New_York'];
export const WIDGET_THEMES: Record<WidgetTheme, { label: string; accent: string; background: string; foreground: string }> = {
  light: { label: 'Jasny', accent: '#9333ea', background: '#ffffff', foreground: '#241b35' },
  dark: { label: 'Ciemny', accent: '#e6bb72', background: '#18243c', foreground: '#f7f4ed' },
  neon: { label: 'Neon', accent: '#67e8f9', background: '#111827', foreground: '#f5f3ff' },
  ticket: { label: 'Bilet', accent: '#a63a26', background: '#fff1d7', foreground: '#472b25' },
};

export function zonedInput(timestamp: number, zone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp);
  const part = (name: string) => parts.find(p => p.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

// Resolve a wall-clock time without relying on the visitor's computer timezone.
// Multiple candidates occur when the clock moves back; no candidate means a DST gap.
export function zonedCandidates(input: string, zone: string): number[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input) || !WIDGET_ZONES.includes(zone)) return [];
  const wall = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(wall)) return [];
  const offsets = new Set<number>();
  for (const hours of [-24, -12, 0, 12, 24]) {
    const sample = wall + hours * 3600000;
    offsets.add(Date.parse(`${zonedInput(sample, zone)}:00Z`) - sample);
  }
  return [...offsets].map(offset => wall - offset).filter(candidate => zonedInput(candidate, zone) === input).sort((a,b) => a-b);
}

export function defaultWidgetSettings(now = Date.now()): WidgetSettings {
  return { kind: 'countdown', theme: 'light', title: 'Widzimy się na webinarze!', subtitle: 'Zarezerwuj chwilę dla siebie. Zaczynamy za…', finishText: 'Wydarzenie już się rozpoczęło!', zone: 'Europe/Warsaw',
    deadline: zonedInput(now + 86400000, 'Europe/Warsaw'), start: zonedInput(now, 'Europe/Warsaw'), occurrence: 'earlier', source: 'manual', total: 100, value: 32, delta: -2,
    steps: [], progressMode: 'value', endpoint: '', ...WIDGET_THEMES.light, animated: true, radius: 24, showDetails: true };
}

export function compileWidget(settings: WidgetSettings) {
  const errors: string[] = [];
  let ambiguous = false;
  const resolve = (input: string, label: string) => {
    const candidates = zonedCandidates(input, settings.zone);
    if (candidates.length > 1) ambiguous = true;
    if (!candidates.length) { errors.push(`${label}: wybierz poprawną datę i godzinę. Ta godzina może nie istnieć podczas zmiany czasu.`); return 0; }
    return candidates[settings.occurrence === 'later' ? candidates.length - 1 : 0];
  };
  const isNumber = (n: number) => Number.isFinite(n);
  const bounded = (n: number) => isNumber(n) && n >= 0 && n <= 1000000;
  if (!WIDGET_ZONES.includes(settings.zone)) errors.push('Wybierz obsługiwaną strefę czasu.');
  if (!['countdown','seats','progress'].includes(settings.kind)) errors.push('Wybierz rodzaj widżetu.');
  if (!['manual','daily','steps','url'].includes(settings.source)) errors.push('Wybierz źródło wartości.');
  if (!settings.title.trim() || settings.title.length > 100) errors.push('Tytuł musi mieć od 1 do 100 znaków.');
  if (settings.subtitle.length > 240 || settings.finishText.length > 140) errors.push('Skróć opis lub komunikat końcowy.');
  for (const color of [settings.accent,settings.background,settings.foreground]) if (!/^#[\da-f]{6}$/i.test(color)) errors.push('Wybierz poprawny kolor.');
  const timed = settings.kind === 'countdown' || (settings.kind === 'progress' && settings.progressMode === 'time');
  const end = timed ? resolve(settings.deadline, 'Termin') : 0;
  const needsStart = (timed && settings.kind === 'progress') || (!timed && settings.source === 'daily');
  const start = needsStart ? resolve(settings.start, 'Początek') : 0;
  if (timed && settings.kind === 'progress' && end <= start) errors.push('Koniec musi przypadać po początku.');
  if (!timed) {
    if (!bounded(settings.total) || settings.total < 1 || (settings.kind === 'seats' && !Number.isInteger(settings.total))) errors.push('Łączna liczba musi być większa od zera (do 1 000 000).');
    if (!bounded(settings.value) || settings.value > settings.total || (settings.kind === 'seats' && !Number.isInteger(settings.value))) errors.push('Wartość musi mieścić się między 0 a łączną liczbą. Miejsca podaj w całości.');
    if (settings.source === 'daily' && (!isNumber(settings.delta) || Math.abs(settings.delta) > 1000000 || (settings.kind === 'seats' && !Number.isInteger(settings.delta)))) errors.push('Podaj poprawną dzienną zmianę wartości.');
  }
  let endpoint = '';
  if (!timed && settings.source === 'url') {
    try { const url = new URL(settings.endpoint); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); endpoint = url.href; }
    catch { errors.push('Podaj pełny adres HTTPS do danych JSON, bez danych logowania.'); }
  }
  const steps = !timed && settings.source === 'steps' ? settings.steps.map((step, i) => ({ at: resolve(step.date, `Etap ${i+1}`), value: step.value })) : [];
  if (!timed && settings.source === 'steps') {
    if (!steps.length || steps.length > 30) errors.push('Dodaj od 1 do 30 etapów harmonogramu.');
    if (steps.some(step => !bounded(step.value) || step.value > settings.total || (settings.kind === 'seats' && !Number.isInteger(step.value)))) errors.push('Wartości etapów muszą mieścić się między 0 a łączną liczbą.');
    if (new Set(steps.map(step => step.at)).size !== steps.length) errors.push('Etapy muszą mieć różne daty i godziny.');
  }
  const config = { version: 1, kind: settings.kind, theme: settings.theme, title: settings.title, subtitle: settings.subtitle, finishText: settings.finishText,
    zone: settings.zone, end, start, source: timed ? 'manual' : settings.source, total: settings.total, value: settings.value, delta: settings.delta, steps: steps.sort((a,b)=>a.at-b.at),
    progressMode: settings.progressMode, endpoint, accent: settings.accent, background: settings.background, foreground: settings.foreground,
    animated: Boolean(settings.animated), radius: Math.min(40,Math.max(0,Number(settings.radius)||0)), showDetails: Boolean(settings.showDetails) };
  return { config, errors: [...new Set(errors)], ambiguous };
}

export const escapeWidgetAttribute = (value: string) => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]!);
export function widgetEmbedCode(settings: WidgetSettings) {
  const { config, errors } = compileWidget(settings);
  if (errors.length) return '';
  return `<!-- Kreator Grafik AI: samodzielny widżet, bez zewnętrznych bibliotek -->\n<ak-live-widget-v1 data-config="${escapeWidgetAttribute(JSON.stringify(config))}"></ak-live-widget-v1>\n<script>\n${runtime}\n</script>`;
}
export function widgetDocument(settings: WidgetSettings, preview = false) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Widżet | Kreator Grafik AI</title><style>body{margin:0;padding:16px;box-sizing:border-box;font-family:system-ui,sans-serif}ak-live-widget-v1{display:block;max-width:760px;margin:auto}</style></head><body>${widgetEmbedCode(settings)}${preview ? `<script>new ResizeObserver(function(){parent.postMessage({type:'ak-widget-size',height:Math.ceil(document.body.getBoundingClientRect().height)},'*')}).observe(document.body)</script>` : ''}</body></html>`;
}
