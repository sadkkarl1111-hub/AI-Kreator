import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGeneratorHandoffStorage, hasAdArtDirection, openAdGenerator } from './adGeneratorHandoff';

const makeTab = () => {
  const values = new Map<string, string>([['companyAssistantContext', 'old-company']]);
  return { sessionStorage: { setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, values, opener: window as Window | null, location: { replace: vi.fn() }, close: vi.fn() };
};
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });
describe('separate ad generator tabs', () => {
  it('recognizes only structured ad prompts as having their own art direction', () => {
    expect(hasAdArtDirection('Create ONE finished advertising image.\nBEGIN_VISIBLE_TEXT\n["Oferta"]\nEND_VISIBLE_TEXT')).toBe(true);
    expect(hasAdArtDirection('Reklama w stylu neon')).toBe(false);
    expect(hasAdArtDirection('BEGIN_VISIBLE_TEXT')).toBe(false);
  });
  it('consumes only the selected storage without mixing another draft into the new ad', () => {
    localStorage.setItem('companyAssistantPrompt', 'company draft');
    sessionStorage.setItem('companyAssistantPrompt', 'ad draft');
    const storage = getGeneratorHandoffStorage(sessionStorage, localStorage);
    storage.removeItem('companyAssistantPrompt');
    expect(storage).toBe(sessionStorage);
    expect(localStorage.getItem('companyAssistantPrompt')).toBe('company draft');
    expect(getGeneratorHandoffStorage(sessionStorage, localStorage)).toBe(localStorage);
  });
  it('each click has isolated prompt and does not overwrite the company draft', () => {
    localStorage.setItem('companyAssistantPrompt', 'company draft');
    const first = makeTab(), second = makeTab();
    vi.spyOn(window, 'open').mockReturnValueOnce(first as unknown as Window).mockReturnValueOnce(second as unknown as Window);
    openAdGenerator('first ad'); openAdGenerator('second ad', 'illustration');
    expect(first.values.get('companyAssistantPrompt')).toBe('first ad');
    expect(second.values.get('companyAssistantPrompt')).toBe('second ad');
    expect(second.values.get('companyAssistantStyle')).toBe('illustration');
    expect(first.values.get('companyAssistantContext')).toBe('null');
    expect(first.opener).toBeNull(); expect(first.location.replace).toHaveBeenCalledWith('/generator');
    expect(localStorage.getItem('companyAssistantPrompt')).toBe('company draft');
  });
  it('reports blocked popup and closes failed handoff tab', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => openAdGenerator('ad')).toThrow(/Zezwól/);
    const tab = makeTab(); tab.sessionStorage.setItem = () => { throw new Error('blocked storage'); };
    open.mockReturnValue(tab as unknown as Window);
    expect(() => openAdGenerator('ad')).toThrow(/skopiować prompt/);
    expect(tab.close).toHaveBeenCalled();
  });
});
