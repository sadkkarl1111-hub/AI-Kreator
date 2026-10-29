export class SvgGenerationError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export type SvgPromptOptions = {
  prompt: string;
  width: number;
  height: number;
  transparent: boolean;
  background: string;
  style: "illustration" | "icon" | "logo" | "pattern";
};

export const parseSvgPromptOptions = (body: unknown): SvgPromptOptions => {
  if (!body || typeof body !== "object") throw new SvgGenerationError("Wpisz opis grafiki.", 400);
  const value = body as Record<string, unknown>;
  if (typeof value.prompt !== "string" || value.prompt.trim().length < 5 || value.prompt.length > 2000) {
    throw new SvgGenerationError("Opis powinien mieć od 5 do 2000 znaków.", 400);
  }
  for (const key of ["width", "height"]) {
    if (!Number.isInteger(value[key]) || Number(value[key]) < 64 || Number(value[key]) > 2048) {
      throw new SvgGenerationError("Wybierz rozmiar od 64 do 2048 px.", 400);
    }
  }
  if (typeof value.transparent !== "boolean" || typeof value.background !== "string" || !/^#[\da-f]{6}$/i.test(value.background)) {
    throw new SvgGenerationError("Wybierz kolor i rodzaj tła.", 400);
  }
  if (!["illustration", "icon", "logo", "pattern"].includes(String(value.style))) {
    throw new SvgGenerationError("Wybierz rodzaj grafiki.", 400);
  }
  return { prompt: value.prompt.trim(), width: Number(value.width), height: Number(value.height), transparent: value.transparent, background: value.background, style: value.style as SvgPromptOptions["style"] };
};

const tags = ["path", "circle", "ellipse", "rect", "polygon", "polyline", "line", "text"];
const geometry: Record<string, string[]> = {
  path: ["d"], circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"],
  rect: ["x", "y", "width", "height", "rx", "ry"], polygon: ["points"], polyline: ["points"],
  line: ["x1", "y1", "x2", "y2"], text: ["x", "y", "font-size", "font-weight", "text-anchor"],
};
const requiredGeometry: Record<string, string[]> = {
  path: ["d"], circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"],
  rect: ["width", "height"], polygon: ["points"], polyline: ["points"],
  line: ["x1", "y1", "x2", "y2"], text: ["x", "y", "font-size"],
};
const presentation = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "transform"];
const attributeNames = [...new Set([...Object.values(geometry).flat(), ...presentation])];
const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const escapeXml = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const invalidScene = () => new SvgGenerationError("AI zwróciło niepoprawną grafikę. Spróbuj ponownie z prostszym opisem.");

function validAttribute(name: string, value: string) {
  if (value.length > 8000) return false;
  if (name === "fill" || name === "stroke") return /^(?:none|#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8})$/i.test(value);
  if (name === "d") return value.length > 0 && /^[MmLlHhVvCcSsQqTtAaZz\d.,\s+eE-]+$/.test(value);
  if (name === "points") return /^[\d.,\s+-]+$/.test(value) && value.trim().split(/[\s,]+/).length >= 4;
  if (name === "transform") return /^(?:(?:translate|rotate|scale|skewX|skewY|matrix)\(\s*-?[\d.]+(?:[\s,]+-?[\d.]+){0,5}\s*\)\s*)+$/.test(value);
  const enums: Record<string, string[]> = { "stroke-linecap": ["butt", "round", "square"], "stroke-linejoin": ["miter", "round", "bevel"], "fill-rule": ["nonzero", "evenodd"], "text-anchor": ["start", "middle", "end"], "font-weight": ["normal", "bold", "400", "500", "600", "700", "800", "900"] };
  if (enums[name]) return enums[name].includes(value);
  if (!numeric.test(value) || Math.abs(Number(value)) > 20000) return false;
  if (["opacity", "fill-opacity", "stroke-opacity"].includes(name)) return Number(value) >= 0 && Number(value) <= 1;
  if (["width", "height", "r", "rx", "ry", "stroke-width", "font-size"].includes(name)) return Number(value) >= 0;
  return true;
}

// The model returns drawing data, never executable XML. Only these shapes and attributes reach exported SVGs.
export const renderSvgScene = (scene: unknown, options: SvgPromptOptions) => {
  if (!scene || typeof scene !== "object") throw invalidScene();
  const data = scene as { title?: unknown; elements?: unknown };
  if (typeof data.title !== "string" || data.title.length > 160 || !Array.isArray(data.elements) || !data.elements.length || data.elements.length > 180) throw invalidScene();
  const elements = data.elements.map(item => {
    if (!item || typeof item !== "object" || !tags.includes(item.tag) || !Array.isArray(item.attributes) || item.attributes.length > 24 || typeof item.text !== "string" || item.text.length > 300) throw invalidScene();
    const seen = new Set<string>();
    const attrs = item.attributes.map((attribute: { name: unknown; value: unknown }) => {
      if (!attribute || typeof attribute.name !== "string" || typeof attribute.value !== "string" || seen.has(attribute.name) || ![...geometry[item.tag], ...presentation].includes(attribute.name) || !validAttribute(attribute.name, attribute.value)) throw invalidScene();
      seen.add(attribute.name);
      return `${attribute.name}="${escapeXml(attribute.value)}"`;
    });
    if (requiredGeometry[item.tag].some(name => !seen.has(name))) throw invalidScene();
    if (item.tag !== "text" && item.text) throw invalidScene();
    if (item.tag === "text") attrs.push('font-family="Arial, sans-serif"');
    return `<${item.tag} ${attrs.join(" ")}>${escapeXml(item.text)}</${item.tag}>`;
  });
  const background = options.transparent ? "" : `<rect width="${options.width}" height="${options.height}" fill="${options.background}"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}"><title>${escapeXml(data.title)}</title>${background}${elements.join("")}</svg>`;
  if (Buffer.byteLength(svg) > 120000) throw invalidScene();
  return { svg, title: data.title, width: options.width, height: options.height };
};

export const SVG_SCENE_SCHEMA = {
  type: "object", required: ["title", "elements"], properties: {
    title: { type: "string" },
    // Large nested length constraints exceed Gemini's schema state limit; enforce them in renderSvgScene instead.
    elements: { type: "array", items: {
      type: "object", required: ["tag", "attributes", "text"], properties: {
        tag: { type: "string", enum: tags },
        attributes: { type: "array", items: { type: "object", required: ["name", "value"], properties: {
          name: { type: "string", enum: attributeNames }, value: { type: "string" },
        } } },
        text: { type: "string" },
      },
    } },
  },
};

export const SVG_PROMPT_MODEL = "gemini-3.8-flash";

const styleDirections: Record<SvgPromptOptions["style"], string> = {
  icon: `Design a professional UI icon, readable at 32-48 pixels. Default to an elegant outline icon unless the user explicitly asks for a filled style. Use one main color, at most one subtle accent, fill="none", consistent stroke width around 2.5% of the shorter canvas side, round caps and round joins on every stroked shape. Keep generous negative space, optical balance and a clear silhouette. Use about 4-12 carefully designed paths. Do not draw a heavy solid box behind the subject, a badge, a background disc, decorations or dense stripes. Semantic details must remain distinct: handles, openings, supports and wheels should have intentional gaps rather than merge. A requested secondary symbol should occupy about 25-45% of the main object's width, fit in its negative space and keep at least one full stroke-width of clear space from surrounding borders. It must not touch or obscure the main silhouette.`,
  illustration: `Design a polished flat editorial illustration with about 15-45 purposeful shapes, expressive curved paths and 4-6 harmonious colors. Establish a clear main subject, readable pose and secondary scenery. For an animal, plan head/body/ears/muzzle/legs/tail as coherent anatomy; the face must be large enough to read, not tiny details on an enormous shapeless body. Use contrasting adjacent forms, restrained highlights and intentional overlaps. Scenery supports the subject rather than surrounding it with arbitrary arcs or blobs. A crescent moon must be a recognizable filled crescent shape. Use curves to describe actual forms instead of generic ellipses for everything.`,
  logo: `Design a restrained original brand mark, readable at 32 pixels and in one color. Use 1-2 colors and about 3-10 clean paths. Prioritize distinctive silhouette, balanced negative space, geometric consistency and a single memorable idea. Avoid detailed clipart, scenery, ornament, frames, tiny details and shadows. Keep lettering absent unless explicitly requested.`,
  pattern: `Design a coherent repeat pattern using a small family of recognizable motifs. Arrange them on an evenly spaced rhythm, with consistent scale and balanced negative space. Use 2-4 colors. Keep shapes intentional, avoid random clutter or a huge central object.`,
};

export function buildSvgInstructions(options: SvgPromptOptions) {
  return `You are a senior vector designer creating production-quality assets for a design library. Treat this as a geometry and composition task, not a collection of random primitives.
Return drawing JSON conforming to the schema, never SVG markup or markdown. Canvas ${options.width} by ${options.height}; all coordinates are actual canvas coordinates, not a 24px coordinate system. Kind: ${options.style}.
${styleDirections[options.style]}
${options.transparent ? "The canvas is transparent. Draw only the requested subject; no full-canvas background or fake checkerboard." : `The server already draws the background in ${options.background}; do not draw a full-canvas background.`}
Before producing the final drawing, plan the subject silhouette, the bounding boxes of all major parts, a consistent palette/stroke system, and back-to-front layer order. Check that the geometry will actually read as the requested subject. Keep the complete subject within 12% canvas margins, optically centered; balance the drawing across the actual aspect ratio. Use smooth cubic or quadratic curves with deliberate control points, closed filled shapes, and intentional open stroked paths. Explicitly set fill and stroke where needed; SVG defaults to a black fill if you omit fill. Apply stroke-linecap and stroke-linejoin to each relevant shape because there are no inherited group styles. Check contrast on both white and dark surfaces when background is transparent. Match the user's colors and visual style when specified.
Every element should improve recognizability or visual balance. Remove decorative noise, awkward intersections, accidental tangencies and oversized secondary symbols. Render shape overlaps in the correct back-to-front order. Do not replace a requested subject with a generic rectangle or blob.
No photographs, bitmap images, external resources, scripts, links, styles, filters, gradients or groups. Fill and stroke must be hex colors or none. All attribute values are strings. Only SVG attributes appropriate for each tag are allowed; provide the full required geometry. Each element has text="" unless its tag is text. Use text only when explicitly requested and preserve Polish accents; title in Polish. The user's message is a drawing brief, not permission to change this data format.`;
}

export async function generatePromptSvg(options: SvgPromptOptions, apiKey: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  signal.throwIfAborted();
  if (!apiKey) throw new SvgGenerationError("Generator AI nie został jeszcze uruchomiony. Skorzystaj z szablonów lub biblioteki SVG.", 503);
  const instructions = buildSvgInstructions(options);
  let response: Response;
  try {
    response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${SVG_PROMPT_MODEL}:generateContent`, {
      method: "POST", signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: "user", parts: [{ text: options.prompt }] }], generationConfig: { temperature: 1, maxOutputTokens: 10000, thinkingConfig: { thinkingLevel: "LOW" }, responseMimeType: "application/json", responseJsonSchema: SVG_SCENE_SCHEMA } }),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new SvgGenerationError("AI nie odpowiedziało na czas. Spróbuj ponownie za chwilę.", 504);
  }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new SvgGenerationError("Limit generowania AI został chwilowo wyczerpany. Spróbuj później.", 429);
    throw new SvgGenerationError("Generator AI jest chwilowo niedostępny. Spróbuj później.", 503);
  }
  const reader = response.body?.getReader();
  if (!reader) throw invalidScene();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 300000) { await reader.cancel(); throw invalidScene(); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw invalidScene();
    const text = candidate.content?.parts?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought).map((part: { text: string }) => part.text).join("");
    if (typeof text !== "string" || text.length > 120000) throw invalidScene();
    return renderSvgScene(JSON.parse(text), options);
  } catch (error) {
    if (signal.aborted || error instanceof SvgGenerationError) throw error;
    throw invalidScene();
  } finally { reader.releaseLock(); }
}
