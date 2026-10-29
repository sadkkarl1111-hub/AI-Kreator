import sharp from 'sharp';

export type ImageBackground = 'auto' | 'opaque' | 'transparent';

export function promptRequestsTransparency(prompt: string) {
  const text = prompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
  if (/\b(?:not|no|without|avoid)\s+(?:a\s+)?transparent\s+background\b|\b(?:nieprzezroczyst\w*|opaque)\s+(?:tlo|background)\b/.test(text)) return false;
  return /\btransparent\s+background\b|\bbackground\s*[:=]\s*transparent\b|\b(?:png\s+)?alpha\s+channel\b|\bbez\s+tla\b|\bprzezroczyst\w*\s+tlo\b|\btlo\s+przezroczyst\w*\b/.test(text);
}

export const supportsNativeTransparency = (provider: string, model: string) => provider === 'openai' && model.startsWith('gpt-image-');

export function resolveImageBackground(value: unknown, prompt: string, provider: string, model: string): ImageBackground {
  if (value !== undefined && !['auto', 'opaque', 'transparent'].includes(String(value))) throw new Error('INVALID_IMAGE_BACKGROUND');
  if (value === 'transparent' && !supportsNativeTransparency(provider, model)) throw new Error('TRANSPARENT_BACKGROUND_UNSUPPORTED');
  if (value === 'opaque' || value === 'transparent') return value;
  return supportsNativeTransparency(provider, model) && promptRequestsTransparency(prompt) ? 'transparent' : 'auto';
}

export function imageBackgroundPrompt(prompt: string, background: ImageBackground) {
  if (background === 'transparent') return `${prompt}\nOUTPUT BACKGROUND REQUIREMENT: Return a PNG with a real transparent alpha channel outside the subject. Do not draw checkerboard squares, a white/gray background, a floor or a studio backdrop. Keep the entire subject visible. Any checkerboard is a transparency viewer pattern, never part of the output pixels.`;
  if (background === 'opaque') return `${prompt}\nOUTPUT BACKGROUND REQUIREMENT: Return an opaque image with a fully filled background. No transparent pixels.`;
  return prompt;
}

// An opaque PNG (including a painted checkerboard) is not a transparent result.
// Reject it before saving, so the handler's existing refund path remains active.
export async function assertImageBackground(base64: string, background: ImageBackground) {
  if (background !== 'transparent') return;
  const buffer = Buffer.from(base64, 'base64');
  const metadata = await sharp(buffer).metadata();
  if (!metadata.hasAlpha || (await sharp(buffer).stats()).isOpaque) throw new Error('TRANSPARENT_BACKGROUND_MISSING');
}
