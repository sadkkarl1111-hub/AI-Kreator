import { AD_STYLES, ANALYSIS_INSTRUCTIONS, ANALYSIS_SCHEMA, CONCEPT_INSTRUCTIONS, CONCEPT_SCHEMA, parseAdAnalysis, parseAdConcepts } from './adCreative.js';
import { setTimeout as delay } from 'node:timers/promises';
import { COMPETITOR_DIRECTION, type AdCampaignOptions } from './adResearch.js';

export type AdImage = { data: string; mediaType: string };
type JsonRequest = {
  instructions: string;
  input: string;
  schema: unknown;
  images?: AdImage[];
  signal: AbortSignal;
  model?: string;
  reasoningEffort?: 'low' | 'medium';
  maxOutputTokens?: number;
};
export type AdJsonClient = (request: JsonRequest) => Promise<unknown>;
export const AD_PROMPT_MODEL = { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' } as const;
export const AD_ANALYSIS_MODEL = { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' } as const;
export type AdTokenUsage = { inputTokens: number; outputTokens: number; reasoningTokens: number; cachedInputTokens?: number; cacheWriteTokens?: number };

// Translate the existing schema contract, without changing copy limits or fields.
export function toOpenAiAdSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('Invalid ad schema');
  const node = schema as Record<string, unknown>;
  const result: Record<string, unknown> = { ...node, type: String(node.type || '').toLowerCase() };
  if (result.type === 'object') {
    const properties = node.properties as Record<string, unknown> || {};
    result.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, toOpenAiAdSchema(value)]));
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  if (result.type === 'array') result.items = toOpenAiAdSchema(node.items);
  return result;
}

export class AdProviderError extends Error {
  constructor(public retryable: boolean, public status = 0, public code = 'INCOMPLETE') { super('Dostawca AI nie zwrócił kompletnej odpowiedzi.'); this.name = 'AdProviderError'; }
}
export class AdBriefError extends Error {
  constructor() { super('Nie udało się odczytać, co reklamujemy. Dopisz krótki opis oferty lub dodaj wyraźniejsze zdjęcie.'); this.name = 'AdBriefError'; }
}

export function createAdJsonClient(apiKey: string, onUsage?: (usage: AdTokenUsage) => void): AdJsonClient {
  if (!apiKey.trim()) throw new AdProviderError(false, 503, 'missing_api_key');
  return async ({ instructions, input, schema, images = [], signal, model = AD_PROMPT_MODEL.id, reasoningEffort = 'medium', maxOutputTokens = 12000 }) => {
    signal.throwIfAborted();
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, store: false, instructions,
        input: [{ role: 'user', content: [{ type: 'input_text', text: input }, ...images.map(image => ({ type: 'input_image', image_url: `data:${image.mediaType};base64,${image.data}`, detail: 'high' }))] }],
        reasoning: { effort: reasoningEffort }, max_output_tokens: maxOutputTokens,
        text: { format: { type: 'json_schema', name: 'ad_creative_response', strict: true, schema: toOpenAiAdSchema(schema) } },
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { code?: string } };
      const code = /^[a-zA-Z0-9_]{1,80}$/.test(error.error?.code || '') ? error.error!.code! : 'HTTP_ERROR';
      throw new AdProviderError((response.status === 429 && code !== 'insufficient_quota') || response.status >= 500, response.status, code);
    }
    const data = await response.json() as {
      status?: string; incomplete_details?: { reason?: string };
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      usage?: { input_tokens?: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number }; output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } };
    };
    if (Number.isSafeInteger(data.usage?.input_tokens) && data.usage!.input_tokens! >= 0 && Number.isSafeInteger(data.usage?.output_tokens) && data.usage!.output_tokens! >= 0) onUsage?.({ inputTokens: data.usage!.input_tokens!, outputTokens: data.usage!.output_tokens!, reasoningTokens: data.usage?.output_tokens_details?.reasoning_tokens || 0, cachedInputTokens: data.usage?.input_tokens_details?.cached_tokens || 0, cacheWriteTokens: data.usage?.input_tokens_details?.cache_write_tokens || 0 });
    if (data.status !== 'completed') throw new AdProviderError(data.incomplete_details?.reason === 'max_output_tokens');
    const content = data.output?.filter(item => item.type === 'message').flatMap(item => item.content || []) || [];
    if (content.some(part => part.type === 'refusal')) throw new AdProviderError(false, 0, 'refusal');
    const raw = content.filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('\n');
    if (!raw) throw new AdProviderError(true);
    return JSON.parse(raw);
  };
}

async function validatedRequest<T>(client: AdJsonClient, request: JsonRequest, parse: (value: unknown) => T, maxAttempts = 2): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    request.signal.throwIfAborted();
    try {
      return parse(await client({ ...request, input: request.input + (attempt ? '\nPoprzednia odpowiedź była niekompletna lub niezgodna. Odpowiedz od nowa, zwięźle, według schematu i limitów. Zachowaj wyłącznie fakty z oryginalnego materiału.' : '') }));
    } catch (error) {
      if (request.signal.aborted || attempt === maxAttempts - 1 || (error instanceof AdProviderError && !error.retryable)) throw error;
      if (error instanceof AdProviderError && error.status) await delay(2000, undefined, { signal: request.signal });
    }
  }
  throw new Error('Nie udało się przygotować reklamy.');
}

export async function generateAdCampaign(client: AdJsonClient, description: string, images: AdImage[], signal: AbortSignal, options: AdCampaignOptions = {}) {
  const analysis = await validatedRequest(client, {
    instructions: ANALYSIS_INSTRUCTIONS,
    input: JSON.stringify({ description, imageCount: images.length }),
    images,
    schema: ANALYSIS_SCHEMA,
    signal,
    model: AD_ANALYSIS_MODEL.id,
    reasoningEffort: 'low',
    maxOutputTokens: 5000,
  }, value => parseAdAnalysis(value, description, images.length));
  if (!analysis.offer.trim()) throw new AdBriefError();
  const groups = Array.from({ length: Math.ceil(AD_STYLES.length / 4) }, (_, index) => AD_STYLES.slice(index * 4, index * 4 + 4));
  const results = await Promise.allSettled(groups.map(styles => validatedRequest(client, {
    instructions: CONCEPT_INSTRUCTIONS + '\n' + COMPETITOR_DIRECTION,
    input: JSON.stringify({ analysis, styles, campaignContext: options }),
    schema: CONCEPT_SCHEMA,
    signal,
    reasoningEffort: 'low',
    maxOutputTokens: 9000,
  }, value => parseAdConcepts(value, styles, analysis))));
  signal.throwIfAborted();
  const seen = new Set<string>();
  const duplicateDirections: { style: typeof AD_STYLES[number]; needsImage: boolean }[] = [];
  const prompts = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).filter(p => {
    const key = p.hookPl.toLocaleLowerCase('pl');
    if (seen.has(key)) {
      duplicateDirections.push({ style: AD_STYLES.find(style => style.id === p.styleId)!, needsImage: p.needsImage });
      return false;
    }
    seen.add(key);
    return true;
  });
  // Repair only duplicate directions, at most four in one extra provider call.
  // Never rerun the full campaign or silently discard a requested scene on the first duplicate.
  const repairDirections = duplicateDirections.slice(0, 4);
  const repairStyles = repairDirections.map(item => ({ ...item.style, requiredNeedsImage: item.needsImage }));
  if (repairStyles.length) {
    try {
      const repaired = await validatedRequest(client, {
        instructions: CONCEPT_INSTRUCTIONS + '\n' + COMPETITOR_DIRECTION + '\nPole avoidHooks zawiera nagłówki innych gotowych reklam. Wybierz INNY hook i kąt komunikacji dla każdego wskazanego stylu, zachowując jego scenerię oraz prawdziwe fakty. Nie powtarzaj żadnego avoidHooks. Każdy styl ma requiredNeedsImage — zwróć dokładnie tę wartość w needsImage, aby nie zmieniać proporcji zestawu.',
        input: JSON.stringify({ analysis, styles: repairStyles, avoidHooks: prompts.map(prompt => prompt.hookPl), campaignContext: options }),
        schema: { ...CONCEPT_SCHEMA, properties: { concepts: { ...CONCEPT_SCHEMA.properties.concepts, minItems: repairStyles.length, maxItems: repairStyles.length } } },
        signal,
        reasoningEffort: 'low',
        maxOutputTokens: 9000,
      }, value => {
        const concepts = parseAdConcepts(value, repairStyles, analysis);
        if (concepts.some(concept => seen.has(concept.hookPl.toLocaleLowerCase('pl')))) throw new Error('Powtórzony hook po poprawce.');
        if (concepts.some((concept, index) => concept.needsImage !== repairDirections[index]?.needsImage)) throw new Error('Poprawka zmieniła plan zdjęcia.');
        return concepts;
      }, 1);
      prompts.push(...repaired);
    } catch { signal.throwIfAborted(); }
  }
  prompts.sort((a, b) => AD_STYLES.findIndex(style => style.id === a.styleId) - AD_STYLES.findIndex(style => style.id === b.styleId));
  if (prompts.length < 4) {
    const providerFailure = results.find(result => result.status === 'rejected' && result.reason instanceof AdProviderError);
    if (providerFailure?.status === 'rejected') throw providerFailure.reason;
    throw new Error('Nie udało się przygotować kompletnych koncepcji.');
  }
  return { analysis, prompts, partial: prompts.length < AD_STYLES.length };
}
