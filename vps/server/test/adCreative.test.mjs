import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AD_IMAGE_QUALITY_LOCK, AD_STYLES, ANALYSIS_SCHEMA, CONCEPT_SCHEMA, parseAdAnalysis, parseAdConcepts, isCompiledAdPrompt } from '../dist/lib/adCreative.js';
import { AD_ANALYSIS_MODEL, AD_PROMPT_MODEL, AdBriefError, AdProviderError, createAdJsonClient, generateAdCampaign, toOpenAiAdSchema } from '../dist/lib/adCreativeAi.js';

const description = 'Automatyzuję faktury dla małych firm. Dane z formularza trafiają do CRM. Umów rozmowę o wdrożeniu.';
const analysis = { offer: 'Automatyzacja faktur i CRM', facts: [
  { id: 'F1', text: 'Automatyzacja faktur', source: 'opis', quote: 'Automatyzuję faktury' },
  { id: 'F2', text: 'Dane z formularza w CRM', source: 'opis', quote: 'Dane z formularza trafiają do CRM' },
] };
const hooks = ['Faktury bez ręcznego przepisywania', 'Formularz wypełniony. CRM już wie.', 'Mniej kopiowania, więcej rozmów', 'Twoje dane trafiają do CRM', 'Nie przepisuj kolejnego formularza', 'Od formularza do gotowej faktury', 'Zobacz drogę danych do CRM', 'Zaprojektuj wygodniejszy obieg faktur', 'Przebij się przez stos faktur', 'Dane płyną prosto do CRM', 'Zaplanuj drogę formularza do CRM', 'Zbuduj sprawniejszą obsługę formularzy'];
const row = (style, patch = {}) => {
  const needsImage = AD_STYLES.indexOf(style) % 4 < 2;
  return ({
  styleId: style.id, title: style.label, hookPl: hooks[AD_STYLES.indexOf(style)], emphasisPl: hooks[AD_STYLES.indexOf(style)].split(' ').slice(0, 2).join(' '), subheadPl: '', benefitsPl: ['✓ Dane w CRM', 'Bez przepisywania'], ctaPl: 'Umów rozmowę', badgePl: '',
  hookMechanism: 'Konkretny problem', whyItWorks: 'Pokazuje zadanie, które można zautomatyzować.', sceneConcept: 'Właściciel odkłada faktury. Formularz łączy się z kartą CRM.',
  artDirectionEn: style.category === 'scenic' ? style.direction : 'An owner closes a paper invoice folder at a warm wooden desk. A connected form and a minimal CRM card sit in the middle ground. In the background soft morning light reveals the texture of the wall. Use tactile paper, restrained depth and one orange directional accent.',
  layoutEn: 'Headline in the upper left, hero in the center, benefits to the right and a wide CTA at the bottom inside generous insets.',
  colors: ['#102030', '#f8fafc', '#f97316'], sourceFactIds: ['F1', 'F2'], needsImage,
  imageNote: needsImage ? 'Załącz wyraźny portret właściciela od pasa w górę.' : 'AI wygeneruje neutralną postać i scenę od podstaw.', ...patch,
  });
};
const styles = AD_STYLES.slice(0, 4);
const concepts = styles => ({ concepts: styles.map(s => row(s)) });
const parsedAnalysis = () => parseAdAnalysis(analysis, description, 0);
const request = () => ({ instructions: 'test', input: description, schema: {}, signal: new AbortController().signal });

test('competitor inspiration and the campaign goal reach concepts without polluting factual offer analysis', async () => {
  const context = { goal: 'messages', competitorExamples: [{ id: 'competitor-1', pageName: 'Other brand', text: 'Fikcyjna konkurencyjna obietnica 1000 klientów', source: 'manual' }] };
  let analysisCalls = 0, conceptCalls = 0;
  const result = await generateAdCampaign(async req => {
    const input = JSON.parse(req.input);
    if (req.schema === ANALYSIS_SCHEMA) { analysisCalls++; assert.deepEqual(input, { description, imageCount: 0 }); assert.equal(req.images.length, 0); return analysis; }
    conceptCalls++; assert.deepEqual(input.campaignContext, context); assert.match(req.instructions, /never evidence about the user's offer/);
    assert(!JSON.stringify(input.analysis.facts).includes('1000 klientów'));
    return concepts(input.styles.map(style => AD_STYLES.find(item => item.id === style.id)));
  }, description, [], new AbortController().signal, context);
  assert.equal(analysisCalls, 1); assert.equal(conceptCalls, 3); assert.equal(result.prompts.length, 12);
  assert.equal(result.prompts.filter(item => item.needsImage).length, 6);
});

test('facts from description require an actual quote, not invented proof', () => {
  const result = parseAdAnalysis({ ...analysis, facts: [...analysis.facts, { id: 'F3', text: '50 godzin oszczędności', source: 'opis', quote: '50 godzin' }] }, description, 0);
  assert.equal(result.facts.length, 2);
  assert.throws(() => parseAdAnalysis({ facts: [] }, description, 0), /Brak czytelnych/);
});
test('image-only supports OCR and photos without lettering, but not nonexistent sources', () => {
  const facts = [{ id: 'F1', text: 'Świeca w szklanym pojemniku', source: 'zdjęcie 1', quote: '' }];
  assert.equal(parseAdAnalysis({ facts }, '', 1).facts.length, 1);
  assert.throws(() => parseAdAnalysis({ facts }, '', 0));
});
test('compiler preserves Polish copy and puts technical instructions outside visible text', () => {
  const [ad] = parseAdConcepts(concepts(styles), styles, parsedAnalysis());
  const copy = JSON.parse(ad.prompt.split('BEGIN_VISIBLE_TEXT')[1].split('END_VISIBLE_TEXT')[0]);
  assert.deepEqual(copy, [hooks[0], '✓ Dane w CRM', '✓ Bez przepisywania', 'Umów rozmowę']);
  assert(!copy.some(value => /9%|margin|SAFE ZONE|Art direction|Layout/.test(value)));
  assert(ad.prompt.includes('9%'));
  assert(ad.prompt.includes('Typography direction:'));
  assert(ad.prompt.includes('typographically emphasize'));
  assert(ad.prompt.includes('CONTRAST LOCK:'));
  assert(ad.prompt.includes('Every letter must be fully opaque'));
  assert(ad.prompt.includes('never render a black CTA on a dark scene'));
  assert.match(AD_IMAGE_QUALITY_LOCK, /NO TEXT-BEARING PROPS/);
  assert.match(AD_IMAGE_QUALITY_LOCK, /bottom edge at least 10%/);
  assert(ad.prompt.includes(JSON.stringify(ad.emphasisPl)));
  assert.equal(copy.filter(value => value.includes(ad.emphasisPl)).length, 1);
  assert(isCompiledAdPrompt(ad.prompt));
  assert(isCompiledAdPrompt('Selected canvas\n' + ad.prompt));
  assert(!isCompiledAdPrompt('A photo of a cat'));
});
test('rejects technical copy, unknown facts, repeated styles/hooks and excessive text', () => {
  for (const patch of [
    { hookPl: 'TEXT SAFE ZONE: minimum 9%' }, { sourceFactIds: ['F999'] }, { emphasisPl: 'nie istnieje' }, { emphasisPl: 'i' },
    { hookPl: 'a '.repeat(15) }, { colors: ['red'] }, { hookPl: hooks[1] },
  ]) {
    const data = concepts(styles); data.concepts[0] = row(styles[0], patch);
    assert.throws(() => parseAdConcepts(data, styles, parsedAnalysis()));
  }
  const data = concepts(styles); data.concepts[1].styleId = styles[0].id;
  assert.throws(() => parseAdConcepts(data, styles, parsedAnalysis()));
});
test('twelve complete concepts include every style in three bounded batches', async () => {
  const calls = [];
  const result = await generateAdCampaign(async req => {
    calls.push(req); const input = JSON.parse(req.input);
    return input.styles ? concepts(AD_STYLES.filter(s => input.styles.some(x => x.id === s.id))) : analysis;
  }, description, [], request().signal);
  assert.equal(result.prompts.length, 12); assert.equal(result.partial, false);
  assert.equal(new Set(result.prompts.map(p => p.hookPl)).size, 12);
  assert.equal(result.prompts.filter(p => p.needsImage).length, 6);
  assert.deepEqual(result.prompts.map(p => p.styleId), AD_STYLES.map(s => s.id));
  assert.equal(calls.length, 4);
  assert(calls.slice(1).every(call => JSON.parse(call.input).styles.length === 4));
  assert.equal(calls[0].model, AD_ANALYSIS_MODEL.id);
  assert.equal(calls[0].reasoningEffort, 'low');
  assert.equal(calls[0].maxOutputTokens, 5000);
  assert(calls.slice(1).every(call => call.model === undefined && call.reasoningEffort === 'low' && call.maxOutputTokens === 9000));
});

test('each full batch mixes two reference-led and two generated-from-scratch concepts', () => {
  const data = concepts(styles);
  assert.equal(parseAdConcepts(data, styles, parsedAnalysis()).filter(item => item.needsImage).length, 2);
  for (const concept of data.concepts) {
    concept.needsImage = false;
    concept.imageNote = 'AI wygeneruje neutralną scenę od podstaw.';
  }
  assert.throws(() => parseAdConcepts(data, styles, parsedAnalysis()), /miksu zdjęć referencyjnych/);
});

test('impact composition and scenery survive compilation without becoming visible copy', () => {
  const ads = parseAdConcepts(concepts(AD_STYLES), AD_STYLES, parsedAnalysis());
  assert.match(ads[0].prompt, /enormous condensed headline/);
  assert.match(ads[0].prompt, /curved directional arrows/);
  assert.match(ads[0].prompt, /crisp border and controlled glow/);
  for (const [id, anchor] of [['jungle', 'jungle'], ['pool', 'swimming pool'], ['mountains', 'mountain trail'], ['worksite', 'construction site']]) {
    const ad = ads.find(item => item.styleId === id);
    assert.equal(ad.category, 'scenic');
    assert(ad.prompt.includes(anchor));
    const copy = JSON.parse(ad.prompt.split('BEGIN_VISIBLE_TEXT')[1].split('END_VISIBLE_TEXT')[0]);
    assert(!copy.some(text => /Visual style|jungle|swimming pool|mountain trail|construction site/.test(text)));
    assert(!copy.some(text => /20 błędów|darmowy|gratis/i.test(text)));
  }
});

test('scenic concepts cannot silently turn back into generic office scenes', () => {
  for (const style of AD_STYLES.filter(s => s.category === 'scenic')) {
    assert.throws(() => parseAdConcepts({ concepts: [row(style, { artDirectionEn: row(styles[0]).artDirectionEn })] }, [style], parsedAnalysis()), /Scena nie odpowiada/);
  }
});

test('duplicate hook gets one targeted repair without losing its scenic direction', async () => {
  const calls = [];
  const result = await generateAdCampaign(async req => {
    calls.push(req);
    if (req.images) return analysis;
    const input = JSON.parse(req.input);
    const group = AD_STYLES.filter(style => input.styles.some(s => s.id === style.id));
    const data = concepts(group);
    if (input.avoidHooks) {
      assert.deepEqual(group.map(style => style.id), ['mountains']);
      assert(input.avoidHooks.includes(hooks[0]));
      assert.equal(input.styles[0].requiredNeedsImage, row(AD_STYLES.find(style => style.id === 'mountains')).needsImage);
      assert.equal(req.schema.properties.concepts.minItems, 1);
      assert.equal(req.schema.properties.concepts.maxItems, 1);
    } else {
      const mountain = data.concepts.find(concept => concept.styleId === 'mountains');
      if (mountain) { mountain.hookPl = hooks[0]; mountain.emphasisPl = hooks[0].split(' ').slice(0, 2).join(' '); }
    }
    return data;
  }, description, [], request().signal);
  assert.equal(calls.length, 5);
  assert.equal(result.partial, false); assert.equal(result.prompts.length, 12);
  assert.equal(result.prompts.filter(prompt => prompt.needsImage).length, 6);
  assert.deepEqual(result.prompts.map(p => p.styleId), AD_STYLES.map(s => s.id));
  assert.match(result.prompts.find(p => p.styleId === 'mountains').prompt, /mountain trail/);
});

test('failed duplicate repair stays bounded and keeps all other valid concepts', async () => {
  let calls = 0;
  const result = await generateAdCampaign(async req => {
    calls++;
    if (req.images) return analysis;
    const input = JSON.parse(req.input);
    if (input.avoidHooks) throw new Error('repair unavailable');
    const data = concepts(AD_STYLES.filter(style => input.styles.some(s => s.id === style.id)));
    const mountain = data.concepts.find(concept => concept.styleId === 'mountains');
    if (mountain) { mountain.hookPl = hooks[0]; mountain.emphasisPl = hooks[0].split(' ').slice(0, 2).join(' '); }
    return data;
  }, description, [], request().signal);
  assert.equal(calls, 5); assert.equal(result.prompts.length, 11); assert.equal(result.partial, true);
});
test('unreadable image does not become an invented offer about image readability', async () => {
  let calls = 0;
  await assert.rejects(generateAdCampaign(async () => {
    calls++; return { offer: '', facts: [{ id: 'F1', text: 'Nieczytelne symbole', source: 'zdjęcie 1', quote: '' }] };
  }, '', [{ data: 'AAAA', mediaType: 'image/png' }], request().signal), AdBriefError);
  assert.equal(calls, 1);
});
test('malformed analysis is retried from the original image, not damaged JSON', async () => {
  const images = [{ data: 'AAAA', mediaType: 'image/png' }]; const attempts = [];
  const result = await generateAdCampaign(async req => {
    if (req.images) { attempts.push(req); if (attempts.length === 1) throw new SyntaxError('Unterminated string'); return analysis; }
    const input = JSON.parse(req.input); return concepts(AD_STYLES.filter(s => input.styles.some(x => x.id === s.id)));
  }, description, images, request().signal);
  assert.equal(result.prompts.length, 12); assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[1].images, images);
  assert(attempts[1].input.includes('Automatyzuję')); assert(!attempts[1].input.includes('Unterminated'));
});
test('one failed group preserves the other eight concepts and marks partial', async () => {
  let failed = 0;
  const result = await generateAdCampaign(async req => {
    if (req.images) return analysis;
    if (req.input.includes('"id":"collage"')) { failed++; throw new Error('network'); }
    const input = JSON.parse(req.input);
    return concepts(AD_STYLES.filter(s => input.styles.some(x => x.id === s.id)));
  }, description, [], request().signal);
  assert.equal(failed, 2); assert.equal(result.prompts.length, 8); assert.equal(result.partial, true);
});
test('cancellation never starts provider work', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(generateAdCampaign(async () => { calls++; }, description, [], controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});
test('provider authorization failures are not retried or lost behind a generic JSON error', async () => {
  let calls = 0;
  await assert.rejects(generateAdCampaign(async req => {
    calls++;
    if (req.images) return analysis;
    throw new AdProviderError(false, 403, 'PERMISSION_DENIED');
  }, description, [], request().signal), error => error instanceof AdProviderError && error.status === 403);
  assert.equal(calls, 4);
});
test('Responses client supports fast Luna analysis and keeps Sol defaults for concepts', async t => {
  let body; const usage = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-not-a-key');
    body = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ type: 'reasoning', content: [{ type: 'output_text', text: 'not JSON' }] }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }], usage: { input_tokens: 30, output_tokens: 20, output_tokens_details: { reasoning_tokens: 10 } } });
  });
  const client = createAdJsonClient('test-not-a-key', value => usage.push(value));
  assert.deepEqual(await client({ ...request(), schema: ANALYSIS_SCHEMA, images: [{ data: 'AAAA', mediaType: 'image/png' }], model: AD_ANALYSIS_MODEL.id, reasoningEffort: 'low', maxOutputTokens: 5000 }), { ok: true });
  assert.equal(body.model, 'gpt-5.6-luna'); assert.equal(AD_ANALYSIS_MODEL.id, body.model);
  assert.equal(body.store, false); assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.equal(body.max_output_tokens, 5000); assert.equal(body.temperature, undefined);
  assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.input[0].content[1], { type: 'input_image', image_url: 'data:image/png;base64,AAAA', detail: 'high' });
  assert.deepEqual(usage, [{ inputTokens: 30, outputTokens: 20, reasoningTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0 }]);

  assert.deepEqual(await client(request()), { ok: true });
  assert.equal(body.model, 'gpt-5.6-sol'); assert.equal(AD_PROMPT_MODEL.id, body.model);
  assert.equal(body.store, false); assert.deepEqual(body.reasoning, { effort: 'medium' });
  assert.equal(body.max_output_tokens, 12000); assert.equal(body.temperature, undefined);
  assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
  assert.deepEqual(usage, [
    { inputTokens: 30, outputTokens: 20, reasoningTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0 },
    { inputTokens: 30, outputTokens: 20, reasoningTokens: 10, cachedInputTokens: 0, cacheWriteTokens: 0 },
  ]);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }));
  await assert.rejects(client(request()), /kompletnej/);
});
test('both schemas require all fields and forbid extra fields recursively', () => {
  function check(schema) {
    assert.equal(schema.type, schema.type.toLowerCase());
    if (schema.type === 'object') { assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required, Object.keys(schema.properties)); Object.values(schema.properties).forEach(check); }
    if (schema.type === 'array') check(schema.items);
  }
  check(toOpenAiAdSchema(ANALYSIS_SCHEMA)); check(toOpenAiAdSchema(CONCEPT_SCHEMA));
  assert.equal(toOpenAiAdSchema(CONCEPT_SCHEMA).properties.concepts.maxItems, 4);
  assert.equal(ANALYSIS_SCHEMA.type, 'OBJECT');
});
test('Sol refusals and account limits are explicit and never fall back to another model', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }));
  const client = createAdJsonClient('test-not-a-key');
  await assert.rejects(client(request()), error => error.code === 'refusal' && !error.retryable);
  mock.mock.mockImplementation(async () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }));
  await assert.rejects(generateAdCampaign(client, description, [], request().signal), error => error.code === 'insufficient_quota' && !error.retryable);
  assert.equal(mock.mock.callCount(), 2);
  mock.mock.mockImplementation(async () => Response.json({ error: { code: 'model_not_found' } }, { status: 404 }));
  await assert.rejects(client(request()), error => error.code === 'model_not_found' && !error.retryable);
  assert.throws(() => createAdJsonClient(''), error => error.code === 'missing_api_key');
});
