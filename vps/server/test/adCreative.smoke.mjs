// Optional paid provider smoke test. No user records or database writes.
// Run with OPENAI_API_KEY configured. Pass product, automation or image-webinar.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { AD_PROMPT_MODEL, createAdJsonClient, generateAdCampaign } from '../dist/lib/adCreativeAi.js';
const mode = process.argv[2] || 'automation';
const inputs = {
  automation: 'Automatyzujemy faktury oraz obsługę zapytań w małych firmach. Dane z formularza trafiają do CRM i klient otrzymuje odpowiedź e-mail. Celem reklamy jest rozmowa o wdrożeniu. Nie mamy potwierdzonej liczby zaoszczędzonych godzin.',
  product: 'Ręcznie robione świece sojowe w szkle wielokrotnego użytku. Zapachy inspirowane lasem. Chcemy zachęcić do obejrzenia kolekcji w sklepie. Bez rabatów i darmowych dodatków.',
  'image-webinar': '',
};
if (!(mode in inputs) || !process.env.OPENAI_API_KEY) throw new Error('Select a supported fixture and configure the OpenAI provider key.');
const images = [];
if (mode === 'image-webinar') {
  if (process.env.AD_SMOKE_IMAGE) {
    images.push({ data: (await readFile(process.env.AD_SMOKE_IMAGE)).toString('base64'), mediaType: 'image/png' });
  } else {
  const require = createRequire(process.cwd() + '/package.json');
  const sharp = require('sharp');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#f8fafc"/><g font-family="DejaVu Sans,Arial" fill="#102030"><text x="60" y="100" font-size="52" font-weight="bold">BEZPŁATNY WEBINAR: PLAN INWESTOWANIA</text><text x="60" y="220" font-size="34">Dla początkujących. Regularne wpłaty od 500 zł miesięcznie.</text><text x="60" y="300" font-size="34">Poznaj ETF-y, ich koszty i ryzyko.</text><text x="60" y="380" font-size="34">Ułóż plan inwestowania krok po kroku.</text><text x="60" y="460" font-size="34">500 zł to przykład wpłaty, nie cena webinaru.</text><text x="60" y="540" font-size="30">Inwestowanie wiąże się z ryzykiem straty kapitału.</text><text x="60" y="670" font-size="42" font-weight="bold">ZAPISZ SIĘ NA WEBINAR</text></g></svg>`;
  const data = await sharp(Buffer.from(svg)).png().toBuffer();
  images.push({ data: data.toString('base64'), mediaType: 'image/png' });
  }
}
const started = Date.now(); let calls = 0;
const usage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
const client = createAdJsonClient(process.env.OPENAI_API_KEY, item => { for (const key of Object.keys(usage)) usage[key] += item[key]; });
const result = await generateAdCampaign(async request => { calls++; return client(request); }, inputs[mode], images, AbortSignal.timeout(220000));
if (mode === 'image-webinar' && !/webinar/i.test(result.analysis.offer)) throw new Error('OCR fixture failed: the actual webinar offer was not extracted. Check that the fixture font is available.');
console.log(JSON.stringify({ mode, model: AD_PROMPT_MODEL.id, usage, seconds: Math.round((Date.now() - started) / 1000), calls, partial: result.partial, count: result.prompts.length, offer: result.analysis.offer, facts: result.analysis.facts, prompts: result.prompts.map(p => ({ style: p.styleId, hook: p.hookPl, benefits: p.benefitsPl, cta: p.ctaPl, scene: p.sceneConcept })) }, null, 2));
if (process.env.AD_SMOKE_OUTPUT) await writeFile(process.env.AD_SMOKE_OUTPUT, JSON.stringify({ ok: true, ...result, model: AD_PROMPT_MODEL }, null, 2));
if (result.partial) process.exitCode = 1;
