export const PRODUCT_SCENES = [
  { id: 'studio-white', label: 'Białe studio', prompt: 'seamless white studio backdrop, a clean white surface, soft diffused commercial lighting and a subtle contact shadow' },
  { id: 'marble', label: 'Marmur', prompt: 'an elegant pale marble tabletop, restrained luxury styling, soft window light and realistic reflections' },
  { id: 'nature', label: 'Natura', prompt: 'a natural stone surface with subtle greenery in the distant background, soft morning daylight and shallow depth of field' },
  { id: 'wood', label: 'Drewno', prompt: 'a warm oak tabletop, a calm neutral interior background and soft natural side lighting' },
  { id: 'premium', label: 'Ciemne studio', prompt: 'a charcoal studio backdrop and dark pedestal, controlled rim lighting, elegant highlights and realistic contact shadows' },
  { id: 'pastel', label: 'Pastelowy podest', prompt: 'a matte pastel beige podium with a muted blush backdrop, minimal geometric styling and soft studio shadows' },
] as const;

export function buildProductPhotoPrompt(scene: string, notes: string) {
  return [
    'Create a photorealistic commercial product photograph using the product in the supplied image as the exact reference.',
    'Preserve the product identity, silhouette, proportions, materials, colors, packaging, logo and all existing label text. Never invent, rewrite or remove branding or product details.',
    'Replace the original surroundings and staging. Keep the entire product visible, sharp and the clear focal point. Use physically plausible scale, lighting, contact shadows and reflections.',
    `Scene: ${scene}.`,
    notes.trim() ? `Styling preferences: ${notes.trim()}. These must not change the product identity or its labels.` : '',
    'Do not add people, hands, duplicate products, promotional text, watermarks or extra branding. Deliver a finished product photograph, not a collage.',
  ].filter(Boolean).join(' ');
}
