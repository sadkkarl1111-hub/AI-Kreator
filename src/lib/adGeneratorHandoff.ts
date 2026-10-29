// Matches the structured contract compiled by the ad API.
export const hasAdArtDirection = (prompt: string) => prompt.includes('Create ONE finished advertising image.') && prompt.includes('BEGIN_VISIBLE_TEXT') && prompt.includes('END_VISIBLE_TEXT');

export function getGeneratorHandoffStorage(tabStorage: Storage, legacyStorage: Storage): Storage {
  return tabStorage.getItem('companyAssistantPrompt') || tabStorage.getItem('promptGeneratorProPrompt') ? tabStorage : legacyStorage;
}

// Each generator tab receives its own prompt; another click cannot overwrite it.
export function openAdGenerator(prompt: string, style = 'realistic') {
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new Error('Zezwól na otwieranie nowej karty, aby przejść do generatora.');
  try {
    for (const key of ['companyAssistantContext', 'promptGeneratorProPrompt', 'companyAssistantPrompt', 'companyAssistantPromptSource', 'companyAssistantFormat', 'companyAssistantStyle']) tab.sessionStorage.removeItem(key);
    tab.sessionStorage.setItem('companyAssistantPrompt', prompt);
    tab.sessionStorage.setItem('companyAssistantContext', 'null');
    tab.sessionStorage.setItem('companyAssistantPromptSource', 'ad-generator');
    tab.sessionStorage.setItem('companyAssistantFormat', '1:1');
    tab.sessionStorage.setItem('companyAssistantStyle', style);
    tab.opener = null;
    tab.location.replace('/generator');
  } catch {
    tab.close();
    throw new Error('Nie udało się otworzyć generatora. Możesz skopiować prompt i wkleić go ręcznie.');
  }
}
