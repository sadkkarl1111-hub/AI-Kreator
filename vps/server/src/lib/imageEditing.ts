import sharp from "sharp";

const inputOptions = { limitInputPixels: 40_000_000 };

export class ImageEditInputError extends Error {}

export function badgeEditInstruction(value: unknown, prompt: string): string {
  if (value === undefined) return prompt;
  if (!value || typeof value !== "object") throw new ImageEditInputError("Niepoprawny zakres edycji badge’a.");
  const edit = value as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    const result = typeof edit[key] === "string" ? edit[key].trim() : "";
    if (!result || result.length > limit) throw new ImageEditInputError("Uzupełnij dane wybranej zmiany badge’a.");
    return JSON.stringify(result);
  };
  switch (edit.action) {
    case "replace-text":
      return `Replace only the existing lettering ${text("oldText", 120)} with exactly ${text("newText", 120)}. Match the original lettering technique, font character, stroke texture, weight, fill color, outline color, perspective and baseline. Fit the replacement within the original text area, adjusting letter size only as needed. Erase the old glyphs and write the new glyphs directly on the SAME original surface. Preserve the original surface color and texture behind and between the letters. Do NOT add any rectangle, panel, box, banner, solid fill or new backing behind the text. Do NOT invert the foreground and background colors. The selection is not a shape to draw or fill. Keep every other inscription unchanged. Do not alter the badge surface or decoration.`;
    case "change-color":
      return `Change only the color of ${text("target", 180)} to ${text("color", 80)}. Preserve all lettering verbatim, shapes, texture, pencil strokes, materials, highlights, shadows and opacity. Recolor the existing artwork without redrawing it.`;
    case "remove-element":
      return `Remove only ${text("target", 180)}. Reconstruct the underlying surface using the original texture and shading. Keep all other objects and inscriptions unchanged.`;
    case "custom":
      if (!prompt || prompt.length > 1000) throw new ImageEditInputError("Opisz zmianę w zaznaczonym obszarze.");
      return prompt;
    default:
      throw new ImageEditInputError("Wybierz rodzaj zmiany badge’a.");
  }
}

export function preservingEditPrompt(instruction: string, masked: boolean): string {
  return [
    "Edit the supplied original image in place. It is the source artwork, not an inspiration or a style reference.",
    "Apply only the requested change. Preserve the exact original illustration technique: pencil must stay pencil, sketch must stay sketch, flat must stay flat, 3D must stay 3D. Do not beautify, polish, modernize, restyle or redesign the image.",
    "Preserve composition, framing, perspective, geometry, palette, texture, stroke quality, materials, lighting, shadows, background and alpha transparency except where the requested change strictly requires it.",
    "A text-only request changes only the specified lettering. A color-only request changes only the specified color and keeps every inscription verbatim. Do not add icons, stars, decorations, objects or text. Do not move or resize existing objects.",
    "For a text-only request, keep the same surface behind and between the new glyphs. Never add a panel, rectangle, banner or solid fill behind the replacement text, and never invert the text and surface colors.",
    masked ? "The mask defines the only editable area. All pixels outside it are locked. Keep the original canvas and object positions, including within the mask. The mask is a guide and must not appear in the output." : "Preserve every element that the request does not explicitly change.",
    `Requested change: ${instruction}`,
  ].join(" ");
}

export type PreparedEditMask = {
  width: number;
  height: number;
  sourcePixels: Buffer;
  selection: Uint8Array;
  sourceBase64: string;
  alphaMaskBase64: string;
  redMaskBase64: string;
};

// The browser sends red on white. Providers need a source-sized mask; OpenAI
// uses transparent = editable, while Gemini receives the red guide separately.
export async function prepareEditMask(imageBase64: string, maskBase64: string): Promise<PreparedEditMask> {
  try {
    const source = await sharp(Buffer.from(imageBase64, "base64"), inputOptions).rotate().toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = source.info;
    const mask = await sharp(Buffer.from(maskBase64, "base64"), inputOptions).rotate().resize(width, height, { fit: "fill", kernel: "nearest" }).toColourspace("srgb").ensureAlpha().raw().toBuffer();
    const selection = new Uint8Array(width * height);
    const alphaMask = Buffer.alloc(width * height * 4, 255);
    const redMask = Buffer.alloc(width * height * 4, 255);
    let selected = 0;
    for (let p = 0; p < selection.length; p++) {
      const i = p * 4;
      if (mask[i] > 180 && mask[i + 1] < 100 && mask[i + 2] < 100 && mask[i + 3] > 10) {
        selection[p] = 1;
        selected++;
        alphaMask[i + 3] = 0;
        redMask[i + 1] = redMask[i + 2] = 0;
      }
    }
    if (!selected) throw new ImageEditInputError("Zaznacz pędzlem napis lub element do zmiany.");
    const raw = { width, height, channels: 4 as const };
    const [sourcePng, alphaPng, redPng] = await Promise.all([
      sharp(source.data, { raw }).png().toBuffer(),
      sharp(alphaMask, { raw }).png().toBuffer(),
      sharp(redMask, { raw }).png().toBuffer(),
    ]);
    return { width, height, sourcePixels: source.data, selection, sourceBase64: sourcePng.toString("base64"), alphaMaskBase64: alphaPng.toString("base64"), redMaskBase64: redPng.toString("base64") };
  } catch (error) {
    if (error instanceof ImageEditInputError) throw error;
    throw new ImageEditInputError("Nie udało się odczytać obrazu lub zaznaczenia. Wgraj obraz ponownie.");
  }
}

// Copy selected pixels rather than alpha-compositing: this also supports erasing
// an element to transparency and preserves untouched RGBA bytes exactly.
export async function applyEditMask(editedBase64: string, mask: PreparedEditMask, preserveAlpha = false): Promise<{ base64: string; mimeType: string }> {
  const edited = await sharp(Buffer.from(editedBase64, "base64"), inputOptions).rotate().resize(mask.width, mask.height, { fit: "fill" }).toColourspace("srgb").ensureAlpha().raw().toBuffer();
  const output = Buffer.from(mask.sourcePixels);
  for (let p = 0; p < mask.selection.length; p++) {
    if (mask.selection[p]) {
      if (preserveAlpha && mask.sourcePixels[p * 4 + 3] === 0) continue;
      edited.copy(output, p * 4, p * 4, p * 4 + (preserveAlpha ? 3 : 4));
    }
  }
  const png = await sharp(output, { raw: { width: mask.width, height: mask.height, channels: 4 } }).png().toBuffer();
  return { base64: png.toString("base64"), mimeType: "image/png" };
}
