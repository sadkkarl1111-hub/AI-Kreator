import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import runtime from './embedWidgetRuntime.js?raw';
import { compileWidget, defaultWidgetSettings, widgetEmbedCode, zonedCandidates, type WidgetSettings } from './embedWidgets';

const base = () => defaultWidgetSettings(Date.parse('2027-01-01T12:00:00Z'));
describe('timezone and configuration', () => {
  it('resolves Polish winter/summer time independently of the browser timezone', () => {
    expect(zonedCandidates('2027-01-01T12:00','Europe/Warsaw')).toEqual([Date.parse('2027-01-01T11:00Z')]);
    expect(zonedCandidates('2027-06-01T12:00','Europe/Warsaw')).toEqual([Date.parse('2027-06-01T10:00Z')]);
    expect(zonedCandidates('2027-06-01T12:00','America/New_York')).toEqual([Date.parse('2027-06-01T16:00Z')]);
  });
  it('rejects nonexistent dates and spring DST gaps, and exposes both fall occurrences', () => {
    expect(zonedCandidates('2027-02-29T10:00','Europe/Warsaw')).toEqual([]);
    expect(zonedCandidates('2027-03-28T02:30','Europe/Warsaw')).toEqual([]);
    const fall = zonedCandidates('2027-10-31T02:30','Europe/Warsaw');
    expect(fall).toHaveLength(2); expect(fall[1]-fall[0]).toBe(3600000);
    const first = compileWidget({...base(),deadline:'2027-10-31T02:30'});
    const last = compileWidget({...base(),deadline:'2027-10-31T02:30',occurrence:'later'});
    expect(first.ambiguous).toBe(true);expect(last.config.end-first.config.end).toBe(3600000);
  });
  it('blocks invalid ranges, fractional seats, duplicate steps and backwards date ranges', () => {
    for(const patch of [{total:0},{value:-1},{value:101},{value:1.5},{source:'daily',delta:0.5}]) expect(compileWidget({...base(),kind:'seats',...patch} as WidgetSettings).errors.length).toBeGreaterThan(0);
    const step={date:'2027-01-03T12:00',value:20};
    expect(compileWidget({...base(),kind:'seats',source:'steps',steps:[step,step]}).errors.join()).toContain('różne');
    expect(widgetEmbedCode({...base(),kind:'progress',progressMode:'time',start:'2027-01-04T12:00',deadline:'2027-01-03T12:00'})).toBe('');
  });
  it('requires a public HTTPS data address without embedded credentials', () => {
    for(const endpoint of ['http://example.com/data','javascript:alert(1)','https://user:secret@example.com/data','']) expect(compileWidget({...base(),kind:'seats',source:'url',endpoint}).errors.length).toBeGreaterThan(0);
    expect(compileWidget({...base(),kind:'seats',source:'url',endpoint:'https://example.com/data'}).errors).toEqual([]);
  });
  it('exports escaped configuration with one independent inline runtime and no library imports', () => {
    const title='</script><img src=x onerror=alert(1)>';
    const code=widgetEmbedCode({...base(),title});
    expect(code.match(/<script>/g)).toHaveLength(1);expect(code.match(/<\/script>/g)).toHaveLength(1);
    expect(code).not.toContain(title);expect(code).not.toContain('<script src=');expect(code).not.toContain('import ');
    const host=document.createElement('div');host.innerHTML=code;
    expect(host.querySelectorAll('img')).toHaveLength(0);
    expect(JSON.parse(host.querySelector('ak-live-widget-v1')!.getAttribute('data-config')!).title).toBe(title);
  });
});

describe('standalone exported runtime', () => {
  beforeAll(()=>{new Function(runtime)();});
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2027-01-01T12:00Z'));});
  afterEach(()=>{document.body.replaceChildren();vi.useRealTimers();vi.unstubAllGlobals();});
  const mount=(settings:WidgetSettings)=>{
    const result=compileWidget(settings);expect(result.errors).toEqual([]);
    const el=document.createElement('ak-live-widget-v1');el.setAttribute('data-config',JSON.stringify(result.config));document.body.append(el);return el;
  };
  it('expires once at zero, displays the chosen message and never restarts on reload', () => {
    const settings={...base(),deadline:'2027-01-01T13:01',finishText:'Zaczynamy!'};
    const el=mount(settings);
    vi.advanceTimersByTime(61000);
    expect([...el.shadowRoot!.querySelectorAll('.digit strong')].map(el=>el.textContent)).toEqual(['00','00','00','00']);
    expect(el.shadowRoot!.querySelector('.expired')).toHaveTextContent('Zaczynamy!');
    expect(vi.getTimerCount()).toBe(0);
    const reloaded=mount(settings);expect(reloaded.shadowRoot!.querySelector('.expired')).toHaveTextContent('Zaczynamy!');
  });
  it('keeps several embeds independent and releases timers when removed', () => {
    new Function(runtime)(); // A second pasted block must not re-register the element.
    const one=mount({...base(),kind:'seats',value:32});const two=mount({...base(),kind:'seats',total:10,value:3});
    expect(one.shadowRoot!.querySelector('.metric')).toHaveTextContent('32 miejsca');expect(two.shadowRoot!.querySelector('.metric')).toHaveTextContent('3 miejsca');
    expect(one.shadowRoot!.querySelector('[role=progressbar]')).toHaveAttribute('aria-valuenow','68');
    expect(vi.getTimerCount()).toBe(2);one.remove();expect(vi.getTimerCount()).toBe(1);two.remove();expect(vi.getTimerCount()).toBe(0);
  });
  it('changes daily at the same Polish hour across the 23-hour DST day', () => {
    vi.setSystemTime(new Date('2027-03-28T06:59:00Z')); // 08:59 Warsaw.
    const el=mount({...base(),kind:'seats',source:'daily',start:'2027-03-27T09:00',value:32,delta:-2});
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('32 miejsca');
    vi.setSystemTime(new Date('2027-03-28T07:00:00Z'));vi.advanceTimersByTime(1000);
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('30 miejsc');
    expect(el.shadowRoot!.querySelector('.source')).toHaveTextContent('harmonogramu');
    vi.setSystemTime(new Date('2027-06-01T12:00Z'));vi.advanceTimersByTime(1000);
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('0 miejsc');
  });
  it('applies scheduled values in date order and leaves the base value before the first date', () => {
    const el=mount({...base(),kind:'seats',source:'steps',steps:[{date:'2027-01-03T13:00',value:5},{date:'2027-01-02T13:00',value:20}]});
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('32 miejsca');
    vi.setSystemTime(new Date('2027-01-02T12:00Z'));vi.advanceTimersByTime(1000);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('20 miejsc');
    vi.setSystemTime(new Date('2027-01-04T12:00Z'));vi.advanceTimersByTime(1000);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('5 miejsc');
  });
  it('caps an increasing daily progress bar and does not change before its start', () => {
    const el=mount({...base(),kind:'progress',source:'daily',value:90,delta:25,start:'2027-01-02T13:00'});
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('90%');
    vi.setSystemTime(new Date('2027-01-03T12:00Z'));vi.advanceTimersByTime(1000);
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('100%');
    expect(el.shadowRoot!.querySelector('[role=progressbar]')).toHaveAttribute('aria-valuenow','100');
  });
  it('calculates time progress before, during and after an interval and caps at 100%', () => {
    const el=mount({...base(),kind:'progress',progressMode:'time',start:'2027-01-01T12:00',deadline:'2027-01-01T14:00',finishText:'Gotowe!'});
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('50%');
    vi.setSystemTime(new Date('2026-12-31T12:00Z'));vi.advanceTimersByTime(1000);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('0%');
    vi.setSystemTime(new Date('2027-01-05T12:00Z'));vi.advanceTimersByTime(1000);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('100%');expect(el.shadowRoot!.querySelector('.expired')).toHaveTextContent('Gotowe!');
  });
  it('preserves the last valid feed value on failure and never invents initial remote data', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({total:100,remaining:17})}).mockRejectedValue(new Error('Offline'));vi.stubGlobal('fetch',fetcher);
    const el=mount({...base(),kind:'seats',source:'url',endpoint:'https://example.com/places.json'});
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('—');
    await vi.advanceTimersByTimeAsync(1);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('17 miejsc');
    expect(fetcher).toHaveBeenCalledWith('https://example.com/places.json',expect.objectContaining({credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}));
    await vi.advanceTimersByTimeAsync(60000);expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('17 miejsc');expect(el.shadowRoot!.querySelector('.status')).toHaveTextContent('ostatni poprawny');
  });
  it('renders hostile-looking user text literally in the widget', () => {
    const title='<img src=x onerror=alert(1)>';
    const el=mount({...base(),title});expect(el.shadowRoot!.querySelector('h2')).toHaveTextContent(title);expect(el.shadowRoot!.querySelector('img')).toBeNull();
  });
  it('rejects malformed remote counts and offers no fabricated number', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({total:100,remaining:'17'})}));
    const el=mount({...base(),kind:'seats',source:'url',endpoint:'https://example.com/data'});
    await vi.advanceTimersByTimeAsync(1);
    expect(el.shadowRoot!.querySelector('.metric')).toHaveTextContent('—');
    expect(el.shadowRoot!.querySelector('.status')).toHaveTextContent('Nie udało się');
    expect(el.shadowRoot!.querySelector('[role=progressbar]')).not.toHaveAttribute('aria-valuenow');
  });
});
