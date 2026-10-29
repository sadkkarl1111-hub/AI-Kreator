import { describe, expect, it } from 'vitest';
import { BUILTIN_EMOJI_CATEGORIES, filterEmojiCategories, filterEmojiPacks, mergeEmojiCategories, splitEmojiInput } from './emojiCatalog';

describe('emoji advertising catalog', () => {
  it('finds elements by Polish meaning rather than only by glyph', () => {
    const money = filterEmojiCategories(BUILTIN_EMOJI_CATEGORIES, 'pieniadze').flatMap(category => category.emojis);
    const coffee = filterEmojiCategories(BUILTIN_EMOJI_CATEGORIES, 'kawa').flatMap(category => category.emojis);
    expect(money).toContain('💰');
    expect(coffee).toContain('☕');
    expect(filterEmojiPacks('webinar').map(pack => pack.id)).toContain('webinar');
  });

  it('keeps compound emoji, skin tones and flags as single admin elements', () => {
    expect(splitEmojiInput('👨‍👩‍👧‍👦 👍🏽 🇵🇱 ⚠️')).toEqual(['👨‍👩‍👧‍👦', '👍🏽', '🇵🇱', '⚠️']);
  });

  it('merges an admin category with its built-in equivalent and removes duplicates', () => {
    const categories = mergeEmojiCategories([{ label: '✅ Checkmarki & statusy', emojis: ['✅', '🟢'] }]);
    const status = categories.find(category => category.id === 'status');
    expect(categories.filter(category => /checkmarki/i.test(category.label))).toHaveLength(1);
    expect(status?.emojis.filter(emoji => emoji === '✅')).toHaveLength(1);
  });
});
