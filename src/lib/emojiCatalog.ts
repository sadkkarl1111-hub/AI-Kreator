export type EmojiCategory = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  emojis: string[];
};

export type EmojiPack = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  emojis: string[];
};

export const EMOJI_PACKS: EmojiPack[] = [
  { id: 'sales', label: 'Reklama sprzedażowa', description: 'Hook, korzyści i mocne CTA', keywords: ['sprzedaż', 'reklama', 'cta', 'oferta', 'promocja'], emojis: ['🔥', '🎯', '✅', '👉', '🚀'] },
  { id: 'trading', label: 'Trading i finanse', description: 'Wykres, kapitał i kontrola ryzyka', keywords: ['trading', 'forex', 'giełda', 'finanse', 'inwestowanie', 'pieniądze'], emojis: ['📈', '📊', '💰', '🎯', '⚠️'] },
  { id: 'webinar', label: 'Webinar i szkolenie', description: 'Termin, wiedza i zapis', keywords: ['webinar', 'szkolenie', 'kurs', 'edukacja', 'wydarzenie'], emojis: ['🎥', '📅', '⏰', '🎓', '✅'] },
  { id: 'automation', label: 'Automatyzacja', description: 'Proces, szybkość i odzyskany czas', keywords: ['automatyzacja', 'ai', 'proces', 'system', 'czas'], emojis: ['🤖', '⚙️', '⚡', '🔁', '☕'] },
  { id: 'ecommerce', label: 'E-commerce', description: 'Produkt, dostawa i opinie', keywords: ['sklep', 'produkt', 'ecommerce', 'zakupy', 'dostawa'], emojis: ['🛒', '📦', '🎁', '🏷️', '⭐'] },
  { id: 'trust', label: 'Zaufanie', description: 'Bezpieczeństwo i wiarygodność', keywords: ['zaufanie', 'bezpieczeństwo', 'gwarancja', 'jakość', 'opinia'], emojis: ['🛡️', '🔒', '✅', '⭐', '🤝'] },
  { id: 'real-estate', label: 'Nieruchomości', description: 'Dom, lokalizacja i realizacja', keywords: ['nieruchomości', 'dom', 'mieszkanie', 'budowa', 'remont'], emojis: ['🏠', '🔑', '📍', '📐', '🏗️'] },
  { id: 'beauty', label: 'Beauty i lifestyle', description: 'Efekt, premium i delikatność', keywords: ['beauty', 'uroda', 'kosmetyki', 'salon', 'premium'], emojis: ['✨', '💎', '🌸', '💄', '🤍'] },
];

export const BUILTIN_EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'status', label: '✅ Checkmarki i statusy', description: 'Korzyści, potwierdzenia i status', keywords: ['check', 'tick', 'ptaszek', 'korzyść', 'tak', 'nie', 'status', 'gotowe'], emojis: ['✅', '✔️', '☑️', '❌', '❎', '⭕', '🔴', '🟢', '🟡', '🔵', '🟠', '🟣', '⚪', '⚫', '🟤', '✳️', '❇️', '💯', '🆗', '🆕', '🆓', '🔝', '🔛', '🔜', '🔙', '🔚'] },
  { id: 'gestures', label: '👋 Gesty i dłonie', description: 'Wskazanie, reakcja i emocje', keywords: ['gest', 'dłoń', 'ręka', 'wskazanie', 'palec', 'reakcja'], emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👋', '✋', '🖐️', '🖖', '👆', '👇', '👈', '👉', '☝️', '💪', '🫶', '🫡', '🫵'] },
  { id: 'faces', label: '😀 Emocje i twarze', description: 'Reakcje odbiorcy i ton komunikacji', keywords: ['twarz', 'buźka', 'emocja', 'radość', 'strach', 'zaskoczenie', 'śmiech'], emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😎', '🤓', '🧐', '🤔', '🤗', '🤭', '😐', '😑', '😶', '🙄', '😏', '😬', '🤥', '😌', '😴', '🤮', '🥳', '🥺', '😢', '😭', '😤', '😡', '🤯', '😱', '😈'] },
  { id: 'symbols', label: '🎯 Akcenty reklamowe', description: 'Hooki, wyróżniki, alerty i CTA', keywords: ['symbol', 'znak', 'akcent', 'hook', 'cta', 'cel', 'ogień', 'promocja'], emojis: ['⭐', '🌟', '✨', '💫', '🔥', '💥', '💢', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '🔔', '🔕', '🎵', '🎶', '🏷️', '🔖', '📌', '📍', '🔗'] },
  { id: 'business', label: '💼 Biznes i finanse', description: 'Wyniki, pieniądze i organizacja', keywords: ['biznes', 'praca', 'finanse', 'pieniądze', 'firma', 'wykres', 'dokument'], emojis: ['📊', '📈', '📉', '💰', '💵', '💴', '💶', '💷', '💳', '💎', '⚖️', '🏦', '📧', '📩', '📨', '📬', '📭', '📮', '📝', '📋', '📁', '📂', '🗂️', '📅', '📆', '🗓️', '📇', '🗃️', '🗄️', '📎', '🖇️', '📐', '📏', '🔒', '🔓', '🔑', '🗝️'] },
  { id: 'creative', label: '🎨 Treści i kreatywność', description: 'Grafika, wideo, muzyka i pomysły', keywords: ['kreatywność', 'grafika', 'zdjęcie', 'wideo', 'muzyka', 'pomysł', 'content'], emojis: ['🎨', '🖌️', '🖍️', '✏️', '🖊️', '🖋️', '📷', '📸', '📹', '🎬', '🎭', '🎪', '🎡', '🎢', '🎠', '🎯', '🎲', '🧩', '🎮', '🕹️', '🎧', '🎤', '🎸', '🥁', '🎹', '🎻', '🎺', '🎷'] },
  { id: 'nature', label: '🌍 Natura i scenerie', description: 'Pogoda, rośliny i plener', keywords: ['natura', 'pogoda', 'las', 'dżungla', 'basen', 'góry', 'roślina', 'słońce'], emojis: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌬️', '🌈', '🌊', '🌸', '🌺', '🌻', '🌹', '🌷', '🌱', '🌿', '🍀', '🍁', '🍂', '🌲', '🌳', '🌴', '🌵', '🍄', '🐝', '🦋', '🐛'] },
  { id: 'food', label: '🍕 Jedzenie i napoje', description: 'Gastronomia, kawa i okazje', keywords: ['jedzenie', 'napój', 'restauracja', 'kawa', 'wino', 'ciasto'], emojis: ['☕', '🍵', '🧃', '🥤', '🍺', '🍷', '🥂', '🍾', '🍔', '🍕', '🌮', '🌯', '🥗', '🍣', '🍰', '🎂', '🍩', '🍪', '🍫', '🍬', '🍭', '🍿', '🧁', '🥐', '🍞', '🥑', '🍎', '🍊', '🍋', '🍓', '🍇', '🍉'] },
  { id: 'technology', label: '🚀 Technologia i automatyzacja', description: 'AI, urządzenia, narzędzia i procesy', keywords: ['technologia', 'komputer', 'telefon', 'ai', 'automatyzacja', 'robot', 'narzędzie'], emojis: ['💻', '🖥️', '📱', '📲', '⌨️', '🖱️', '🖨️', '💾', '💿', '📀', '🔌', '🔋', '📡', '🛰️', '🚀', '🤖', '👾', '🎰', '⚙️', '🔧', '🔨', '🛠️', '⛏️', '🪛', '🔩', '🧲', '🧪', '🔬', '🔭'] },
  { id: 'hearts', label: '❤️ Relacje i serca', description: 'Sympatia, społeczność i wdzięczność', keywords: ['serce', 'miłość', 'relacja', 'społeczność', 'wdzięczność'], emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '🫀'] },
  { id: 'numbers', label: '🔢 Cyfry i oznaczenia', description: 'Kroki, kolejność i informacje', keywords: ['cyfra', 'liczba', 'krok', 'kolejność', 'informacja'], emojis: ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '#️⃣', '*️⃣', '🅰️', '🅱️', '🆎', '🆑', '🅾️', 'ℹ️', '🔠', '🔡', '🔣', '🔤'] },
  { id: 'warnings', label: '⚠️ Ostrzeżenia i pilność', description: 'Uwaga, ograniczenie i ważny komunikat', keywords: ['ostrzeżenie', 'uwaga', 'błąd', 'zakaz', 'pilne', 'alert'], emojis: ['⚠️', '🚫', '⛔', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '❗', '❕', '❓', '❔', '‼️', '⁉️', '💡', '🔆', '🔅', '⏰', '⌛'] },
  { id: 'arrows', label: '➡️ Strzałki i kierunki', description: 'Prowadzenie wzroku do CTA', keywords: ['strzałka', 'kierunek', 'cta', 'dalej', 'prawo', 'lewo', 'góra', 'dół'], emojis: ['→', '←', '↑', '↓', '↗', '↘', '↙', '↖', '↔', '↕', '⇒', '⇐', '⇑', '⇓', '⇔', '⇕', '⇗', '⇘', '⇙', '⇖', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↩️', '↪️', '⤴️', '⤵️', '🔄', '🔃', '🔀', '🔁', '🔂', '▶️', '◀️', '🔼', '🔽', '⏩', '⏪', '⏫', '⏬', '➤', '➜', '➔', '➙', '➛', '➝', '➞', '➟', '➠', '➢', '➣', '➥', '➦', '➧', '➨', '➩', '➪', '➫', '➬', '➭', '➮', '➯', '➱', '➲'] },
  { id: 'text-arrows', label: '» Znaki tekstowe', description: 'Minimalistyczne CTA i separatory', keywords: ['tekst', 'strzałka', 'separator', 'minimalistyczne', 'cta'], emojis: ['»', '«', '›', '‹', '>', '<', '>>', '<<', '»»', '««', '⟩', '⟨', '⟫', '⟪', '〉', '〈', '》', '《', '⊳', '⊲', '▸', '◂', '▹', '◃', '▷', '◁', '►', '◄', '≫', '≪', '⋙', '⋘', '⊃', '⊂', '⊇', '⊆'] },
];

const EMOJI_SEARCH_TERMS: Record<string, string[]> = {
  '✅': ['check', 'tick', 'ptaszek', 'tak', 'gotowe'], '✔️': ['check', 'tick', 'ptaszek'], '❌': ['nie', 'błąd', 'zakaz'],
  '🔥': ['ogień', 'hot', 'hit', 'popularne'], '🎯': ['cel', 'target', 'wynik'], '👉': ['cta', 'kliknij', 'tutaj', 'prawo'], '👇': ['cta', 'poniżej', 'dół'],
  '📈': ['wzrost', 'wykres', 'trading', 'zysk'], '📉': ['spadek', 'wykres', 'trading', 'strata'], '📊': ['dane', 'statystyki', 'wykres'],
  '💰': ['pieniądze', 'kapitał', 'finanse'], '💵': ['gotówka', 'dolar', 'pieniądze'], '💳': ['płatność', 'karta', 'zakup'],
  '⚠️': ['uwaga', 'ostrzeżenie', 'ryzyko'], '⏰': ['czas', 'termin', 'pilne'], '📅': ['data', 'termin', 'kalendarz'],
  '🎥': ['webinar', 'wideo', 'nagranie'], '🎓': ['kurs', 'nauka', 'szkolenie'], '☕': ['kawa', 'przerwa', 'spokój'],
  '🤖': ['robot', 'ai', 'automatyzacja'], '⚙️': ['ustawienia', 'proces', 'automatyzacja'], '⚡': ['szybko', 'energia', 'automatyzacja'],
  '🛒': ['koszyk', 'sklep', 'zakupy'], '📦': ['paczka', 'produkt', 'dostawa'], '🎁': ['prezent', 'bonus', 'gratis'], '🏷️': ['cena', 'promocja', 'etykieta'],
  '⭐': ['gwiazda', 'opinia', 'jakość'], '🛡️': ['ochrona', 'bezpieczeństwo', 'gwarancja'], '🔒': ['bezpieczeństwo', 'prywatność'], '🤝': ['współpraca', 'zaufanie'],
  '🏠': ['dom', 'nieruchomość', 'mieszkanie'], '🔑': ['klucz', 'dostęp', 'nieruchomość'], '🏗️': ['budowa', 'nieruchomość'],
  '✨': ['efekt', 'blask', 'beauty', 'nowość'], '💎': ['premium', 'luksus', 'wartość'], '🌸': ['beauty', 'kwiat', 'delikatność'], '💄': ['makijaż', 'beauty', 'kosmetyki'],
  '🌴': ['palma', 'wakacje', 'basen'], '🌊': ['woda', 'morze', 'basen'], '🌲': ['las', 'natura'], '🚀': ['start', 'wzrost', 'szybko'],
};

export const normalizeEmojiSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pl')
  .trim();

export const splitEmojiInput = (value: string): string[] => {
  const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('pl', { granularity: 'grapheme' })
    : null;
  const chunks = segmenter ? Array.from(segmenter.segment(value), item => item.segment) : Array.from(value);
  return [...new Set(chunks.map(item => item.trim()).filter(item => item && !/^[,;|]+$/u.test(item)))];
};

const categoryKey = (label: string) => normalizeEmojiSearch(label.replace(/^\S+\s*/, '').replace(/&/g, ' i ')).replace(/\s+/g, ' ');

export const mergeEmojiCategories = (adminCategories: { label: string; emojis: string[] }[]): EmojiCategory[] => {
  const result = BUILTIN_EMOJI_CATEGORIES.map(category => ({ ...category, emojis: [...category.emojis] }));
  for (const [index, category] of adminCategories.entries()) {
    const labelKey = categoryKey(category.label);
    const existing = result.find(item => categoryKey(item.label) === labelKey);
    if (existing) existing.emojis = [...new Set([...category.emojis, ...existing.emojis])];
    else result.unshift({ id: `admin-${index}-${labelKey}`, label: category.label, description: 'Elementy dodane przez administratora', keywords: [category.label], emojis: [...new Set(category.emojis)] });
  }
  return result;
};

export const filterEmojiCategories = (categories: EmojiCategory[], query: string, categoryId = 'all'): EmojiCategory[] => {
  const tokens = normalizeEmojiSearch(query).split(/\s+/).filter(Boolean);
  return categories
    .filter(category => categoryId === 'all' || category.id === categoryId)
    .map(category => {
      if (!tokens.length) return category;
      const categoryText = normalizeEmojiSearch([category.label, category.description, ...category.keywords].join(' '));
      const categoryMatches = tokens.every(token => categoryText.includes(token));
      const emojis = categoryMatches ? category.emojis : category.emojis.filter(emoji => {
        const emojiText = normalizeEmojiSearch([emoji, ...(EMOJI_SEARCH_TERMS[emoji] || [])].join(' '));
        return tokens.every(token => emojiText.includes(token));
      });
      return { ...category, emojis };
    })
    .filter(category => category.emojis.length > 0);
};

export const filterEmojiPacks = (query: string): EmojiPack[] => {
  const tokens = normalizeEmojiSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return EMOJI_PACKS;
  return EMOJI_PACKS.filter(pack => {
    const text = normalizeEmojiSearch([pack.label, pack.description, ...pack.keywords, ...pack.emojis.flatMap(emoji => EMOJI_SEARCH_TERMS[emoji] || [])].join(' '));
    return tokens.every(token => text.includes(token));
  });
};
