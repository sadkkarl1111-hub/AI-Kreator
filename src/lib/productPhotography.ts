export const PRODUCT_SCENES = [
  { id: 'studio-white', label: 'Białe studio', prompt: 'seamless white studio backdrop, a clean white surface, soft diffused commercial lighting and a subtle contact shadow' },
  { id: 'marble', label: 'Marmur', prompt: 'an elegant pale marble tabletop, restrained luxury styling, soft window light and realistic reflections' },
  { id: 'nature', label: 'Natura', prompt: 'a natural stone surface with subtle greenery in the distant background, soft morning daylight and shallow depth of field' },
  { id: 'wood', label: 'Drewno', prompt: 'a warm oak tabletop, a calm neutral interior background and soft natural side lighting' },
  { id: 'premium', label: 'Ciemne studio', prompt: 'a charcoal studio backdrop and dark pedestal, controlled rim lighting, elegant highlights and realistic contact shadows' },
  { id: 'pastel', label: 'Pastelowy podest', prompt: 'a matte pastel beige podium with a muted blush backdrop, minimal geometric styling and soft studio shadows' },
] as const;

export const PRODUCT_POSES = [
  { id: 'angle', label: 'Pod kątem 45°', prompt: 'Reposition the product into a three-quarter view, rotated approximately 45 degrees toward the camera. Show its front and one side with convincing three-dimensional depth.' },
  { id: 'front', label: 'Na wprost', prompt: 'Stand the product upright and photograph it straight on at product eye level, with its front label facing the camera.' },
  { id: 'top', label: 'Z góry', prompt: 'Create a flat lay: place the product on its back on the surface with its front facing upward, then photograph it from directly overhead at 90 degrees.' },
  { id: 'lying', label: 'Na leżąco', prompt: 'Lay the product horizontally on its side on the surface, with its front branding turned toward the camera. Photograph from an elevated three-quarter angle.' },
  { id: 'low', label: 'Z niskiej perspektywy', prompt: 'Stand the product upright and photograph from a low camera angle looking slightly upward, creating a dimensional hero product shot. Keep the front branding visible.' },
  { id: 'original', label: 'Jak na oryginale', prompt: 'Keep the product orientation and camera angle from the reference image while rebuilding its surroundings and lighting.' },
] as const;

export function buildProductPhotoPrompt(scene: string, notes: string, pose: string = PRODUCT_POSES[0].prompt) {
  return [
    'Create a photorealistic commercial product photograph using the product in the supplied image as the exact reference.',
    'Preserve the product identity, physical shape, proportions, materials, colors, packaging, logo and all existing label text. Never invent, rewrite or remove branding or product details.',
    'The reference defines product identity, not a fixed camera view. Reconstruct and rephotograph the same physical product in the requested pose. Its projected outline, perspective, shading and reflections must change naturally with the new view. Do not merely paste the original cutout onto a new background.',
    `Required product pose and camera view: ${pose}`,
    'Replace the original surroundings and staging. Keep the entire product visible, sharp and the clear focal point. Use physically plausible scale, lighting, contact shadows and reflections.',
    `Scene: ${scene}.`,
    notes.trim() ? `Styling preferences: ${notes.trim()}. These must not change the product identity or its labels.` : '',
    'Do not add people, hands, duplicate products, promotional text, watermarks or extra branding. Deliver a finished product photograph, not a collage.',
  ].filter(Boolean).join(' ');
}
