import { Router } from "express";
import { env } from "../config/env.js";
import {
  CompanyAssistantAnswer,
  createLocalCompanyAssistantSession,
  getLocalCompanyAssistantSession,
  updateLocalCompanyAssistantSession,
} from "../lib/localCompanyAssistantSessionsData.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";
import { requireAdminUser } from "../middleware/requireAdminUser.js";

type Stage = "existing" | "starting" | "idea" | "exploring";
type StartMode = "existing-business" | "starting-business" | "idea-only" | "exploring-niche" | "rebrand";
type FontMood = "elegancki" | "nowoczesny" | "odważny" | "klasyczny" | "magazynowy";

type BriefAnalysis = {
  acknowledgement: string;
  stage: Stage;
  detectedIndustry: string;
  businessType: string;
  confidence: number;
  knownFacts: Record<string, string>;
  missingFields: string[];
  recommendedMaterials: string[];
  recommendedThemes: string[];
  warnings: string[];
  briefQuality?: BriefQuality;
};

type BriefQuality = {
  score: number;
  level: "weak" | "medium" | "strong";
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  conflicts: string[];
};

type AssistantQuestion = {
  field: string;
  text: string;
  quickReplies: string[];
  allowCustom: boolean;
  allowSkip: boolean;
};

type NextQuestionResponse = {
  done: boolean;
  question?: AssistantQuestion;
  estimatedRemaining?: number;
  profileDraft?: Record<string, string>;
};

type StyleRecommendation = {
  themeId: string;
  reason: string;
  colors: string[];
  fontMood: FontMood;
};

type CompanyNameIdea = {
  name: string;
  style: string;
  reason: string;
  caution?: string;
};

const STAGES: Stage[] = ["existing", "starting", "idea", "exploring"];
const START_MODES: StartMode[] = ["existing-business", "starting-business", "idea-only", "exploring-niche", "rebrand"];
const MATERIAL_IDS = [
  "logo-concept",
  "business-card",
  "brandbook",
  "offer-flyer",
  "instagram-post",
  "story-reels-cover",
  "linkedin-post",
  "ad-banner",
  "price-list",
  "voucher",
  "company-starter-pack",
  "niche-map",
  "concept-visualization",
];
const FIELD_IDS = [
  "companyName",
  "logoStatus",
  "logoStyle",
  "brandMood",
  "targetAudience",
  "specialization",
  "differentiator",
  "offer",
  "tone",
  "cta",
  "location",
  "avoidList",
];
const THEME_IDS = [
  "premium-black-gold",
  "minimal-white",
  "luxury-real-estate",
  "bold-agency",
  "local-friendly",
  "clean-medical-beauty",
  "tattoo-dark-ink",
  "street-neon",
  "sport-stadium",
  "pastel-beauty",
  "eco-organic",
  "tech-blue",
  "food-warm",
  "kids-playful",
  "editorial-magazine",
  "creative-gradient",
  "mono-luxury",
  "construction-premium",
  "automations-ai",
  "finance-navy-gold",
  "legal-burgundy",
  "salon-champagne",
  "fitness-energy",
  "coffee-craft",
  "medical-trust",
  "creative-studio",
  "local-clean",
];

const THEME_META: Record<string, { colors: string[]; fontMood: FontMood; aliases: string[] }> = {
  "premium-black-gold": { colors: ["#111111", "#f7f2e8", "#c9a227", "#ffffff"], fontMood: "elegancki", aliases: ["premium", "luksus", "dorad", "kancel"] },
  "minimal-white": { colors: ["#ffffff", "#111827", "#e5e7eb", "#9ca3af"], fontMood: "nowoczesny", aliases: ["minimal", "czysto", "prosto"] },
  "luxury-real-estate": { colors: ["#0f172a", "#ffffff", "#d6b46a", "#94a3b8"], fontMood: "elegancki", aliases: ["nieruch", "apartament", "deweloper"] },
  "bold-agency": { colors: ["#111827", "#ec4899", "#38bdf8", "#ffffff"], fontMood: "odważny", aliases: ["social", "agenc", "marketing"] },
  "local-friendly": { colors: ["#fbf7ef", "#2f3e2f", "#d88945", "#ffffff"], fontMood: "klasyczny", aliases: ["lokal", "usług", "sąsiedz"] },
  "clean-medical-beauty": { colors: ["#ffffff", "#d8b4a0", "#7f8c8d", "#f5f5f4"], fontMood: "elegancki", aliases: ["kosmet", "beauty", "medycz"] },
  "tattoo-dark-ink": { colors: ["#0b0b0f", "#f3efe7", "#8b1e3f", "#c7a76c"], fontMood: "odważny", aliases: ["tatua", "tattoo", "piercing"] },
  "street-neon": { colors: ["#111827", "#00f5d4", "#ff2e63", "#faff00"], fontMood: "odważny", aliases: ["street", "event", "muzyka"] },
  "sport-stadium": { colors: ["#052e16", "#ffffff", "#22c55e", "#facc15"], fontMood: "odważny", aliases: ["sport", "piłk", "pilk", "klub"] },
  "pastel-beauty": { colors: ["#4a2c2a", "#fff1f2", "#f9a8d4", "#c4b5fd"], fontMood: "elegancki", aliases: ["paznok", "makija", "wellness"] },
  "eco-organic": { colors: ["#1f3d2b", "#f4efe6", "#a3b18a", "#d4a373"], fontMood: "klasyczny", aliases: ["eko", "natural", "zdrow"] },
  "tech-blue": { colors: ["#0f172a", "#eff6ff", "#2563eb", "#38bdf8"], fontMood: "nowoczesny", aliases: ["it", "ai", "tech", "saas", "automatyzac", "proces", "workflow", "zapier", "make", "n8n"] },
  "food-warm": { colors: ["#3b1f14", "#fff7ed", "#f97316", "#facc15"], fontMood: "klasyczny", aliases: ["gastro", "kawiar", "restaur", "food"] },
  "kids-playful": { colors: ["#1e3a8a", "#fefce8", "#fb7185", "#60a5fa"], fontMood: "nowoczesny", aliases: ["dzieci", "rodzin", "edukac"] },
  "editorial-magazine": { colors: ["#111111", "#fafafa", "#dc2626", "#a3a3a3"], fontMood: "magazynowy", aliases: ["magazyn", "portal", "newsletter"] },
  "creative-gradient": { colors: ["#111827", "#f0f9ff", "#a855f7", "#ec4899"], fontMood: "nowoczesny", aliases: ["twórc", "kurs", "online"] },
  "mono-luxury": { colors: ["#050505", "#ffffff", "#d4d4d8", "#737373"], fontMood: "elegancki", aliases: ["mono", "premium", "minimal"] },
};

const safeString = (value: unknown, max = 2000) => (typeof value === "string" ? value.trim().slice(0, max) : "");

Object.assign(THEME_META, {
  "construction-premium": { colors: ["#18181b", "#f8fafc", "#f59e0b", "#52525b"], fontMood: "nowoczesny" as FontMood, aliases: ["budow", "remont", "wykoĹ„c", "elektryk", "hydraul", "tapet", "malowan"] },
  "automations-ai": { colors: ["#08111f", "#f8fbff", "#38bdf8", "#8b5cf6"], fontMood: "nowoczesny" as FontMood, aliases: ["automatyzac", "ai", "proces", "workflow", "make", "zapier", "n8n"] },
  "finance-navy-gold": { colors: ["#0b1324", "#f8fafc", "#d4af37", "#64748b"], fontMood: "elegancki" as FontMood, aliases: ["finans", "forex", "inwest", "trading", "kapita"] },
  "legal-burgundy": { colors: ["#2a0f18", "#fff7ed", "#9f1239", "#c8b68a"], fontMood: "klasyczny" as FontMood, aliases: ["praw", "kancel", "adwokat", "radca", "doradzt"] },
  "salon-champagne": { colors: ["#3f2a2d", "#fff7f2", "#e7c8a0", "#b76e79"], fontMood: "elegancki" as FontMood, aliases: ["salon", "beauty", "kosmet", "fryz", "paznok"] },
  "fitness-energy": { colors: ["#111827", "#f9fafb", "#ef4444", "#f97316"], fontMood: "odwaĹĽny" as FontMood, aliases: ["fitness", "trening", "siĹ‚own", "dieta", "sport"] },
  "coffee-craft": { colors: ["#2b170f", "#fff7ed", "#b45309", "#facc15"], fontMood: "klasyczny" as FontMood, aliases: ["kawa", "kawiar", "gastro", "piekar", "lokal"] },
  "medical-trust": { colors: ["#0f766e", "#f8fafc", "#99f6e4", "#164e63"], fontMood: "nowoczesny" as FontMood, aliases: ["medycz", "zdrow", "klinika", "terap", "rehabil"] },
  "creative-studio": { colors: ["#1f1235", "#fff7ff", "#f472b6", "#22d3ee"], fontMood: "odwaĹĽny" as FontMood, aliases: ["studio", "twĂłrc", "design", "foto", "film", "art"] },
  "local-clean": { colors: ["#1f2937", "#ffffff", "#10b981", "#e5e7eb"], fontMood: "klasyczny" as FontMood, aliases: ["lokal", "usĹ‚ug", "firma", "serwis", "maĹ‚a firma"] },
});

const BRAND_ANALYSIS_GUARDRAILS = [
  "Nie korzystaj z poprzednich sesji ani domyślnych branż. Analizujesz wyłącznie aktualny opis użytkownika.",
  "Jeśli opis pasuje do kilku branż albo zawiera konflikt, dodaj ostrzeżenie w warnings i obniż confidence.",
  "detectedIndustry ma być konkretne: np. Automatyzacje biznesowe / AI, Studio tatuażu, Firma remontowo-wykończeniowa; nie używaj ogólnego Usługi.",
  "knownFacts ma zawierać companyName, logoStatus, logoStyle, brandMood, offer, targetAudience, differentiator, tone, cta, location, jeśli są jawnie w opisie.",
  "Preferuj materiały praktyczne dla etapu: idea/exploring -> concept-visualization, niche-map, brandbook; existing -> business-card, offer-flyer, instagram-post.",
].join("\n");

const normalizeJsonText = (text: string) => {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenceMatch?.[1] || trimmed).trim();
};

const parseJsonObject = (text: string) => {
  const parsed = JSON.parse(normalizeJsonText(text));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_JSON_OBJECT");
  return parsed as Record<string, unknown>;
};

const extractOpenAiText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
};

const extractOpenAiResponsesText = (data: unknown) => {
  const outputText = (data as any)?.output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  const output = (data as any)?.output;
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .map((part: any) => {
      if (typeof part?.text === "string") return part.text;
      if (typeof part?.content === "string") return part.content;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const extractGeminiText = (data: unknown) => {
  const parts = (data as any)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).filter(Boolean).join("\n").trim();
};

const runJsonLlm = async (prompt: string, temperature = 0.3) => {
  const errors: unknown[] = [];

  if (env.openAiApiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: "Odpowiadasz wyłącznie poprawnym JSON. Bez markdown, bez komentarzy." }],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }],
            },
          ],
          reasoning: { effort: "high" },
          text: { format: { type: "json_object" } },
          temperature,
          max_output_tokens: 1800,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return parseJsonObject(extractOpenAiResponsesText(data));
      }
      errors.push(new Error(`OPENAI_RESPONSES_${response.status}`));
    } catch (error) {
      errors.push(error);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          messages: [
            { role: "system", content: "Odpowiadasz wyłącznie poprawnym JSON. Bez markdown, bez komentarzy." },
            { role: "user", content: prompt },
          ],
          temperature,
          reasoning_effort: "high",
          max_completion_tokens: 1800,
          response_format: { type: "json_object" },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return parseJsonObject(extractOpenAiText(data?.choices?.[0]?.message?.content));
      }
      errors.push(new Error(`OPENAI_${response.status}`));
    } catch (error) {
      errors.push(error);
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: "Odpowiadasz wyłącznie poprawnym JSON. Bez markdown, bez komentarzy." },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens: 1800,
          response_format: { type: "json_object" },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return parseJsonObject(extractOpenAiText(data?.choices?.[0]?.message?.content));
      }
      errors.push(new Error(`OPENAI_GPT41_${response.status}`));
    } catch (error) {
      errors.push(error);
    }
  }

  if (env.geminiApiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: 1200,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (response.ok) {
        const data = await response.json();
        return parseJsonObject(extractGeminiText(data));
      }
      errors.push(new Error(`GEMINI_${response.status}`));
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[0] || new Error("AI_SERVICE_UNAVAILABLE");
};

const includesAny = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const inferIndustry = (description: string) => {
  const text = description.toLowerCase();
  if (includesAny(text, ["tatua", "tattoo", "piercing"])) return "Studio tatuażu";
  if (includesAny(text, ["beauty", "kosmet", "paznok", "makija", "salon piękności"])) return "Beauty / kosmetologia";
  if (includesAny(text, ["fryzjer", "barber", "włosy", "wlosy"])) return "Fryzjerstwo / barber";
  if (includesAny(text, ["kawiar", "restaur", "food", "gastro", "catering"])) return "Gastronomia";
  if (includesAny(text, ["nieruch", "mieszka", "apartament", "deweloper"])) return "Nieruchomości";
  if (includesAny(text, ["piłk", "pilk", "sport", "klub", "mecz", "magazyn"])) return "Sport / magazyn";
  if (includesAny(text, ["social", "content", "instagram", "tiktok"])) return "Social media";
  if (includesAny(text, ["sklep", "e-commerce", "ecommerce", "produkt"])) return "E-commerce";
  if (includesAny(text, ["automatyzac", "automatyzacja", "proces", "make", "zapier", "n8n", "workflow", "ai agent", "agent ai", "sztuczna inteligencja"])) return "Automatyzacje biznesowe / AI";
  if (includesAny(text, ["dorad", "konsult", "trener", "kancel"])) return "Usługi eksperckie";
  return description.split(/[,.!?]/)[0]?.trim().slice(0, 80) || "Branża do doprecyzowania";
};

const inferStage = (description: string): Stage => {
  const text = description.toLowerCase();
  if (includesAny(text, ["szukam niszy", "nie mam pomysłu", "nie wiem co"])) return "exploring";
  if (includesAny(text, ["mam pomysł", "pomysl", "chcę założyć", "chce zalozyc"])) return "idea";
  if (includesAny(text, ["otwieram", "zakładam", "zakladam", "startuję", "startuje"])) return "starting";
  if (includesAny(text, ["prowadzę", "prowadze", "od ", "działa", "dziala", "mam firmę", "mam firme"])) return "existing";
  return "idea";
};

const stageFromStartMode = (startMode: StartMode, description: string): Stage => {
  if (startMode === "existing-business" || startMode === "rebrand") return "existing";
  if (startMode === "starting-business") return "starting";
  if (startMode === "idea-only") return "idea";
  if (startMode === "exploring-niche") return "exploring";
  return inferStage(description);
};

const startModeInstruction = (startMode: StartMode) => {
  const instructions: Record<StartMode, string> = {
    "existing-business": "Użytkownik ma działającą firmę. Nie pytaj najpierw czy ma firmę; skup się na aktualnej ofercie, kliencie, wyróżniku i materiałach.",
    "starting-business": "Użytkownik właśnie zakłada firmę. Priorytet: nazwa, logo, pierwszy pakiet materiałów, pierwsza oferta i styl startowy.",
    "idea-only": "Użytkownik ma tylko pomysł. Nie traktuj go jak działającej firmy; priorytet: koncept, odbiorca, nazwa robocza, wizualizacja i walidacja.",
    "exploring-niche": "Użytkownik szuka niszy. Nie generuj od razu klasycznej wizytówki; priorytet: mapa niszy, porównanie kierunków, koncept wizualny, oferta testowa.",
    rebrand: "Użytkownik odświeża istniejącą markę. Priorytet: co zostaje, co zmienić, jak zachować rozpoznawalność i poprawić spójność wizualną.",
  };
  return instructions[startMode];
};

const themesForIndustry = (industry: string) => {
  const text = industry.toLowerCase();
  const scored = THEME_IDS.map((themeId) => {
    const meta = THEME_META[themeId];
    const score = meta.aliases.some((alias) => text.includes(alias)) ? 10 : 0;
    return { themeId, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored.filter((item) => item.score > 0).map((item) => item.themeId);
  return [...top, "minimal-white", "editorial-magazine", "mono-luxury"].filter((value, index, array) => array.indexOf(value) === index).slice(0, 3);
};

const normalizeTextForSignals = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9ąćęłńóśźż\s/-]/gi, " ");

const industrySignalGroups: Array<{ label: string; keywords: string[] }> = [
  { label: "Nieruchomości", keywords: ["nieruch", "mieszkan", "apartament", "deweloper", "agent nieruch"] },
  { label: "Gastronomia", keywords: ["gastro", "kawiar", "restaur", "catering", "food", "menu"] },
  { label: "Tatuaż", keywords: ["tatua", "tattoo", "piercing", "blackwork", "fineline"] },
  { label: "Beauty", keywords: ["beauty", "kosmet", "paznok", "makijaz", "salon pieknosci"] },
  { label: "Automatyzacje / AI", keywords: ["automatyzac", "proces", "workflow", "zapier", "make", "n8n", "ai agent", "sztuczna inteligencja"] },
  { label: "Sport", keywords: ["sport", "pilka", "mecz", "klub", "trening"] },
  { label: "Budowlanka", keywords: ["budow", "remont", "wykonczen", "elektryk", "tapet", "malowanie"] },
];

const detectIndustrySignals = (text: string) => {
  const normalized = normalizeTextForSignals(text);
  return industrySignalGroups
    .filter((group) => group.keywords.some((keyword) => normalized.includes(keyword)))
    .map((group) => group.label);
};

const buildBriefQuality = (analysis: Omit<BriefAnalysis, "briefQuality">): BriefQuality => {
  const known = analysis.knownFacts || {};
  const gaps: string[] = [];
  const strengths: string[] = [];
  const suggestions: string[] = [];
  const conflicts: string[] = [];
  const knownText = JSON.stringify(known);
  const signals = detectIndustrySignals(`${analysis.detectedIndustry} ${knownText}`);
  const uniqueSignals = Array.from(new Set(signals));

  if (analysis.detectedIndustry && !analysis.detectedIndustry.toLowerCase().includes("doprecyzowania")) {
    strengths.push(`Branża wykryta jako: ${analysis.detectedIndustry}.`);
  } else {
    gaps.push("Branża jest zbyt ogólna.");
  }

  if (known.targetAudience) strengths.push("Jest wskazany klient docelowy.");
  else gaps.push("Brakuje klienta docelowego.");

  if (known.offer || known.specialization) strengths.push("Jest wskazana oferta lub specjalizacja.");
  else gaps.push("Brakuje konkretnej oferty/specjalizacji.");

  if (known.differentiator) strengths.push("Jest wskazany wyróżnik marki.");
  else gaps.push("Brakuje wyróżnika.");

  if (known.tone) strengths.push("Jest określony ton komunikacji.");
  else gaps.push("Brakuje tonu komunikacji.");

  if (known.cta) strengths.push("Jest określone CTA.");
  else gaps.push("Brakuje CTA.");

  if (uniqueSignals.length > 1) {
    conflicts.push(`Opis zawiera sygnały kilku branż: ${uniqueSignals.join(", ")}. Warto potwierdzić właściwy kierunek.`);
  }

  if (analysis.confidence < 0.5) {
    gaps.push("Opis jest zbyt krótki lub niejednoznaczny.");
    suggestions.push("Dopisz w jednym zdaniu: co sprzedajesz, komu i jaki efekt ma dać materiał.");
  }

  if (!known.targetAudience) suggestions.push("Doprecyzuj klienta: lokalny, premium, B2B, młodzi, rodziny, właściciele firm itd.");
  if (!known.offer && !known.specialization) suggestions.push("Nazwij konkretną usługę/produkt, który ma być widoczny w pierwszych materiałach.");
  if (!known.differentiator) suggestions.push("Dodaj powód wyboru marki: szybkość, jakość, styl, doświadczenie, specjalizacja, efekt.");
  if (!known.cta) suggestions.push("Dodaj jedno CTA, np. „Umów konsultację”, „Napisz do nas”, „Zarezerwuj termin”.");

  const requiredFields = ["targetAudience", "offer", "specialization", "differentiator", "tone", "cta"];
  const knownCount = requiredFields.filter((field) => Boolean(known[field])).length;
  const confidencePoints = Math.round(analysis.confidence * 25);
  const completenessPoints = Math.round((knownCount / requiredFields.length) * 65);
  const conflictPenalty = conflicts.length ? 15 : 0;
  const score = Math.max(0, Math.min(100, 10 + confidencePoints + completenessPoints - conflictPenalty));

  return {
    score,
    level: score >= 75 ? "strong" : score >= 45 ? "medium" : "weak",
    strengths: strengths.slice(0, 5),
    gaps: Array.from(new Set(gaps)).slice(0, 6),
    suggestions: Array.from(new Set(suggestions)).slice(0, 6),
    conflicts: Array.from(new Set(conflicts)).slice(0, 4),
  };
};

const attachBriefQuality = (analysis: BriefAnalysis): BriefAnalysis => ({
  ...analysis,
  briefQuality: buildBriefQuality({
    acknowledgement: analysis.acknowledgement,
    stage: analysis.stage,
    detectedIndustry: analysis.detectedIndustry,
    businessType: analysis.businessType,
    confidence: analysis.confidence,
    knownFacts: analysis.knownFacts,
    missingFields: analysis.missingFields,
    recommendedMaterials: analysis.recommendedMaterials,
    recommendedThemes: analysis.recommendedThemes,
    warnings: analysis.warnings,
  }),
});

const materialsForStageAndIndustry = (stage: Stage, industry: string) => {
  const text = industry.toLowerCase();
  if (stage === "exploring") return ["niche-map", "concept-visualization", "brandbook"];
  if (stage === "idea" || stage === "starting") return ["concept-visualization", "brandbook", "instagram-post"];
  if (text.includes("tatua") || text.includes("beauty") || text.includes("fryz")) return ["business-card", "brandbook", "instagram-post"];
  if (text.includes("gastro")) return ["brandbook", "offer-flyer", "instagram-post"];
  return ["business-card", "brandbook", "instagram-post"];
};

const fallbackAnalyzeBrief = (description: string, warnings: string[] = [], startMode: StartMode = "idea-only"): BriefAnalysis => {
  const industry = inferIndustry(description);
  const stage = stageFromStartMode(startMode, description);
  const confidence = description.trim().length < 20 ? 0.35 : industry === "Branża do doprecyzowania" ? 0.48 : 0.78;
  const stageAwareMissingFields = stage === "exploring"
    ? ["targetAudience", "offer", "differentiator", "brandMood", "tone", "cta"]
    : stage === "idea"
      ? ["companyName", "logoStatus", "brandMood", "targetAudience", "offer", "differentiator", "tone", "cta"]
      : stage === "starting"
        ? ["companyName", "logoStatus", "brandMood", "targetAudience", "specialization", "offer", "differentiator", "cta"]
        : ["companyName", "logoStatus", "brandMood", "targetAudience", "specialization", "differentiator", "tone", "cta"];
  const missingFields = confidence < 0.5
    ? ["description"]
    : stageAwareMissingFields;

  return attachBriefQuality({
    acknowledgement:
      confidence < 0.5
        ? "Opis jest jeszcze zbyt ogólny — potrzebuję jednego doprecyzowania."
        : `Rozumiem — ${industry}, etap: ${stage === "existing" ? "firma działa" : stage === "starting" ? "startujesz" : stage === "exploring" ? "szukasz niszy" : "masz pomysł"}. Mam kilka pytań.`,
    stage,
    detectedIndustry: industry,
    businessType: industry.includes("Studio") || industry.includes("Beauty") || industry.includes("Fryzjerstwo") ? "local premium service" : "small business",
    confidence,
    knownFacts: {
      startMode,
      industry,
      description: description.slice(0, 500),
    },
    missingFields: missingFields.slice(0, 8),
    recommendedMaterials: materialsForStageAndIndustry(stage, industry),
    recommendedThemes: themesForIndustry(industry),
    warnings,
  });
};

const normalizeAnalysis = (value: Record<string, unknown>, fallback: BriefAnalysis): BriefAnalysis => {
  const stage = STAGES.includes(value.stage as Stage) ? (value.stage as Stage) : fallback.stage;
  const detectedIndustry = safeString(value.detectedIndustry, 120) || fallback.detectedIndustry;
  const confidence = Math.min(1, Math.max(0, Number(value.confidence ?? fallback.confidence)));
  const knownFacts = value.knownFacts && typeof value.knownFacts === "object" && !Array.isArray(value.knownFacts)
    ? Object.fromEntries(Object.entries(value.knownFacts as Record<string, unknown>).map(([key, item]) => [key, safeString(item, 300)]).filter(([, item]) => item))
    : fallback.knownFacts;

  const missingFields = Array.isArray(value.missingFields)
    ? value.missingFields.map((item) => safeString(item, 60)).filter((item) => FIELD_IDS.includes(item)).slice(0, 8)
    : fallback.missingFields;
  const recommendedMaterials = Array.isArray(value.recommendedMaterials)
    ? value.recommendedMaterials.map((item) => safeString(item, 80)).filter((item) => MATERIAL_IDS.includes(item)).slice(0, 4)
    : fallback.recommendedMaterials;
  const recommendedThemes = Array.isArray(value.recommendedThemes)
    ? value.recommendedThemes.map((item) => safeString(item, 80)).filter((item) => THEME_IDS.includes(item)).slice(0, 3)
    : fallback.recommendedThemes;
  const warnings = Array.isArray(value.warnings) ? value.warnings.map((item) => safeString(item, 200)).filter(Boolean).slice(0, 5) : fallback.warnings;

  return attachBriefQuality({
    acknowledgement: safeString(value.acknowledgement, 240) || fallback.acknowledgement,
    stage,
    detectedIndustry,
    businessType: safeString(value.businessType, 120) || fallback.businessType,
    confidence,
    knownFacts,
    missingFields: missingFields.length > 0 ? missingFields : fallback.missingFields,
    recommendedMaterials: recommendedMaterials.length > 0 ? recommendedMaterials : fallback.recommendedMaterials,
    recommendedThemes: recommendedThemes.length > 0 ? recommendedThemes : fallback.recommendedThemes,
    warnings,
  });
};

const answeredFields = (analysis: BriefAnalysis, answers: CompanyAssistantAnswer[]) => {
  const fields = new Set<string>();
  Object.keys(analysis.knownFacts || {}).forEach((key) => fields.add(key));
  answers.forEach((answer) => fields.add(answer.field));
  return fields;
};

const buildProfileDraft = (analysis: BriefAnalysis, answers: CompanyAssistantAnswer[]) => {
  const answerMap = new Map(answers.filter((item) => item.answer !== "skipped").map((item) => [item.field, item.answer]));
  return {
    companyName: answerMap.get("companyName") || analysis.knownFacts.companyName || "",
    industry: analysis.detectedIndustry || "",
    stage: analysis.stage,
    logoStatus: answerMap.get("logoStatus") || analysis.knownFacts.logoStatus || "",
    logoStyle: answerMap.get("logoStyle") || analysis.knownFacts.logoStyle || "",
    brandMood: answerMap.get("brandMood") || analysis.knownFacts.brandMood || "",
    targetAudience: answerMap.get("targetAudience") || analysis.knownFacts.targetAudience || "",
    specialization: answerMap.get("specialization") || analysis.knownFacts.specialization || "",
    offer: answerMap.get("offer") || analysis.knownFacts.offer || "",
    differentiator: answerMap.get("differentiator") || analysis.knownFacts.differentiator || "",
    tone: answerMap.get("tone") || analysis.knownFacts.tone || "",
    cta: answerMap.get("cta") || analysis.knownFacts.cta || "",
    location: answerMap.get("location") || analysis.knownFacts.location || "",
    avoidList: answerMap.get("avoidList") || analysis.knownFacts.avoidList || "",
  };
};

const industryHas = (industry: string, keywords: string[]) => {
  const lower = industry.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

const questionForField = (field: string, industry: string): AssistantQuestion => {
  const lower = industry.toLowerCase();
  const tattoo = lower.includes("tatua") || lower.includes("tattoo");
  const beauty = lower.includes("beauty") || lower.includes("kosmet");
  const gastro = lower.includes("gastro") || lower.includes("kawiar") || lower.includes("restaur");
  const construction = industryHas(industry, ["budow", "remont", "wyko", "elektryk", "hydraul", "malowan", "tapet"]);
  const automation = industryHas(industry, ["automat", "ai", "proces", "workflow", "zapier", "make", "n8n"]);
  const finance = industryHas(industry, ["finans", "forex", "trading", "inwest", "kapita"]);
  const medical = industryHas(industry, ["medycz", "zdrow", "klinika", "terap", "rehabil"]);
  const sport = industryHas(industry, ["sport", "fitness", "trening", "piłk", "pilk"]);

  if (field === "targetAudience") {
    const text = construction
      ? "Do kogo najczęściej ma trafiać oferta — właściciele mieszkań, deweloperzy, firmy czy administratorzy budynków?"
      : automation
        ? "Dla kogo robisz automatyzacje — małe firmy, e-commerce, usługodawcy, twórcy online czy zespoły sprzedaży?"
        : finance
          ? "Kto jest odbiorcą marki — początkujący inwestorzy, przedsiębiorcy, traderzy czy klienci premium?"
          : medical
            ? "Kto ma najczęściej korzystać z oferty — pacjenci lokalni, osoby po urazach, rodziny czy klienci premium?"
            : sport
              ? "Kto jest głównym odbiorcą — osoby początkujące, sportowcy, rodzice, kluby czy lokalna społeczność?"
              : "Kto jest najważniejszym klientem tej marki?";
    const quickReplies = construction
      ? ["Właściciele mieszkań", "Deweloperzy", "Firmy", "Administratorzy", "Klienci premium", "Rynek lokalny"]
      : automation
        ? ["Małe firmy", "E-commerce", "Usługi lokalne", "Twórcy online", "Zespoły sprzedaży", "Eksperci / trenerzy"]
        : finance
          ? ["Początkujący", "Przedsiębiorcy", "Traderzy", "Inwestorzy premium", "Osoby 30+", "B2B"]
          : medical
            ? ["Pacjenci lokalni", "Klienci premium", "Rodziny", "Osoby aktywne", "Seniorzy", "Po urazach"]
            : sport
              ? ["Początkujący", "Sportowcy", "Rodzice", "Kluby", "Osoby 25-45", "Lokalna społeczność"]
              : ["Klienci lokalni", "Klienci premium", "Małe firmy", "Osoby 20-35", "B2B", "Rodziny", "Twórcy online"];
    return { field, text, quickReplies, allowCustom: true, allowSkip: true };
  }

  if (field === "specialization" || field === "offer") {
    const text = construction
      ? "Które usługi mają być najmocniej widoczne w pierwszych materiałach?"
      : automation
        ? "Jaki efekt automatyzacji ma być najmocniej widoczny w materiałach?"
        : finance
          ? "Jaki temat lub produkt finansowy ma być głównym komunikatem?"
          : medical
            ? "Jaka usługa lub specjalizacja ma być pokazana jako główna?"
            : sport
              ? "Jaki program, usługa albo obszar treningu ma być promowany?"
              : "Jaką główną ofertę, usługę lub specjalizację chcesz pokazać?";
    const quickReplies = construction
      ? ["Malowanie", "Tapetowanie", "Elektryka", "Wykończenia pod klucz", "Remont łazienki", "Premium dla deweloperów", "Szybkie terminy"]
      : automation
        ? ["Oszczędność czasu", "Automatyzacja sprzedaży", "Obsługa klienta", "Raporty i CRM", "AI chatboty", "Make / Zapier / n8n", "Szkolenia online"]
        : finance
          ? ["Edukacja inwestycyjna", "Forex", "Analiza rynku", "Konsultacje", "Kurs online", "Newsletter", "Zarządzanie ryzykiem"]
          : medical
            ? ["Konsultacje", "Rehabilitacja", "Terapia manualna", "Diagnostyka", "Profilaktyka", "Pakiet premium"]
            : sport
              ? ["Trening personalny", "Plan dietetyczny", "Przygotowanie motoryczne", "Dla początkujących", "Online coaching", "Kluby sportowe"]
              : ["Usługa premium", "Konsultacja", "Pakiet startowy", "Oferta lokalna", "Produkt cyfrowy", "Szkolenie", "Obsługa miesięczna"];
    return { field, text, quickReplies, allowCustom: true, allowSkip: true };
  }

  if (field === "differentiator") {
    const text = "Co ma być najmocniejszym powodem wyboru tej marki zamiast konkurencji?";
    const quickReplies = construction
      ? ["Terminowość", "Czysta praca", "Jakość materiałów", "Doświadczenie", "Gwarancja", "Obsługa premium", "Dokładna wycena"]
      : automation
        ? ["Realna oszczędność czasu", "Proste wdrożenie", "Automatyzacje bez kodu", "Doświadczenie biznesowe", "Szybki efekt", "Wsparcie po wdrożeniu", "Szkolenia zespołu"]
        : ["Jakość", "Szybkość", "Podejście premium", "Doświadczenie", "Indywidualne podejście", "Lepszy efekt", "Prosta komunikacja"];
    return { field, text, quickReplies, allowCustom: true, allowSkip: true };
  }

  if (field === "tone" || field === "brandMood") {
    return {
      field,
      text: "Jak marka ma brzmieć i wyglądać w komunikacji?",
      quickReplies: ["Premium", "Ekspercko", "Prosto i konkretnie", "Nowocześnie", "Lokalnie i przyjaźnie", "Odważnie", "Spokojnie i wiarygodnie", "Energetycznie"],
      allowCustom: true,
      allowSkip: true,
    };
  }

  if (field === "cta") {
    return {
      field,
      text: "Jakie jedno wezwanie do działania ma najczęściej pojawiać się na materiałach?",
      quickReplies: ["Napisz do nas", "Umów konsultację", "Zarezerwuj termin", "Sprawdź ofertę", "Poproś o wycenę", "Zobacz portfolio", "Dołącz do listy", "Kup teraz"],
      allowCustom: true,
      allowSkip: true,
    };
  }

  const defaults: Record<string, AssistantQuestion> = {
    targetAudience: {
      field,
      text: tattoo
        ? "Kto najczęściej przychodzi do Twojego studia — osoby po pierwszy tatuaż, stały klienci czy ludzie szukający autorskich projektów?"
        : beauty
          ? "Kto jest Twoją główną klientką lub klientem — szybkie zabiegi, premium pielęgnacja czy metamorfozy?"
          : gastro
            ? "Kto najczęściej ma korzystać z tej marki — lokalni goście, ludzie z laptopami, rodziny czy klienci premium?"
            : "Kto jest najważniejszym klientem tej marki?",
      quickReplies: tattoo ? ["Pierwszy tatuaż", "Autorskie projekty", "Osoby 20-35", "Stała społeczność"] : ["Klienci lokalni", "Klienci premium", "Małe firmy", "Osoby 20-35"],
      allowCustom: true,
      allowSkip: true,
    },
    specialization: {
      field,
      text: tattoo ? "Jaki styl tatuaży chcesz najmocniej pokazywać w materiałach?" : "Jaka specjalizacja ma być najmocniej widoczna w materiałach?",
      quickReplies: tattoo ? ["Realizm", "Fineline", "Blackwork", "Tradycyjny", "Autorskie projekty"] : ["Premium", "Szybka usługa", "Indywidualne podejście", "Edukacja"],
      allowCustom: true,
      allowSkip: true,
    },
    differentiator: {
      field,
      text: tattoo ? "Co sprawia, że klienci wybierają Twoje studio, a nie inne w okolicy?" : "Co realnie odróżnia tę markę od podobnych ofert?",
      quickReplies: tattoo ? ["Autorskie projekty", "Atmosfera", "Higiena i jakość", "Doświadczenie"] : ["Jakość", "Szybkość", "Podejście premium", "Cena"],
      allowCustom: true,
      allowSkip: true,
    },
    offer: {
      field,
      text: "Jaką główną ofertę lub usługę chcesz promować w pierwszych materiałach?",
      quickReplies: tattoo ? ["Tatuaże autorskie", "Konsultacja projektu", "Piercing", "Vouchery"] : ["Konsultacja", "Pakiet startowy", "Usługa premium", "Oferta lokalna"],
      allowCustom: true,
      allowSkip: true,
    },
    tone: {
      field,
      text: "Jak marka ma brzmieć w tekstach — bardziej premium, luźno, odważnie czy ekspercko?",
      quickReplies: ["Premium", "Luźno", "Odważnie", "Ekspercko", "Przyjaźnie"],
      allowCustom: true,
      allowSkip: true,
    },
    cta: {
      field,
      text: "Jakie jedno wezwanie do działania ma pojawiać się najczęściej?",
      quickReplies: tattoo ? ["Umów konsultację", "Zarezerwuj termin", "Napisz na Instagramie", "Sprawdź portfolio"] : ["Umów konsultację", "Napisz do nas", "Sprawdź ofertę", "Zarezerwuj termin"],
      allowCustom: true,
      allowSkip: true,
    },
    companyName: {
      field,
      text: "Jaka jest nazwa marki albo nazwa robocza?",
      quickReplies: ["Nie mam jeszcze nazwy", "AI ma zaproponować nazwę"],
      allowCustom: true,
      allowSkip: true,
    },
    location: {
      field,
      text: "Czy marka działa lokalnie? Jeśli tak, w jakim mieście lub regionie?",
      quickReplies: ["Online", "Cała Polska", "Lokalnie w moim mieście"],
      allowCustom: true,
      allowSkip: true,
    },
    avoidList: {
      field,
      text: "Czego na pewno unikać w wyglądzie materiałów?",
      quickReplies: ["Krzykliwych kolorów", "Taniego stockowego stylu", "Małego tekstu", "Przeładowania"],
      allowCustom: true,
      allowSkip: true,
    },
  };

  return defaults[field] || defaults.differentiator;
};

const fallbackNextQuestion = (analysis: BriefAnalysis, answers: CompanyAssistantAnswer[], questionNumber: number): NextQuestionResponse => {
  if (questionNumber > 5) {
    return { done: true, profileDraft: buildProfileDraft(analysis, answers) };
  }

  const used = answeredFields(analysis, answers);
  const nextField = analysis.missingFields.find((field) => !used.has(field) && field !== "description");
  if (!nextField) {
    return { done: true, profileDraft: buildProfileDraft(analysis, answers) };
  }

  return {
    done: false,
    question: questionForField(nextField, analysis.detectedIndustry),
    estimatedRemaining: Math.max(0, Math.min(5 - questionNumber, analysis.missingFields.length - answers.length - 1)),
  };
};

const normalizeNextQuestion = (value: Record<string, unknown>, fallback: NextQuestionResponse, analysis: BriefAnalysis, answers: CompanyAssistantAnswer[], questionNumber: number): NextQuestionResponse => {
  if (questionNumber > 5 || value.done === true) {
    const profileDraft = value.profileDraft && typeof value.profileDraft === "object" && !Array.isArray(value.profileDraft)
      ? Object.fromEntries(Object.entries(value.profileDraft as Record<string, unknown>).map(([key, item]) => [key, safeString(item, 500)]))
      : buildProfileDraft(analysis, answers);
    return { done: true, profileDraft };
  }

  const rawQuestion = value.question && typeof value.question === "object" && !Array.isArray(value.question) ? value.question as Record<string, unknown> : null;
  if (!rawQuestion) return fallback;
  const field = safeString(rawQuestion.field, 80);
  const text = safeString(rawQuestion.text, 400);
  if (!field || !text || answeredFields(analysis, answers).has(field)) return fallback;

  return {
    done: false,
    question: {
      field,
      text,
      quickReplies: Array.isArray(rawQuestion.quickReplies) ? rawQuestion.quickReplies.map((item) => safeString(item, 80)).filter(Boolean).slice(0, 8) : [],
      allowCustom: rawQuestion.allowCustom !== false,
      allowSkip: rawQuestion.allowSkip !== false,
    },
    estimatedRemaining: Math.max(0, Math.min(5 - questionNumber, Number(value.estimatedRemaining ?? fallback.estimatedRemaining ?? 0))),
  };
};

const styleRecommendationsFor = (profile: Record<string, unknown>, preferredThemes: string[] = []): StyleRecommendation[] => {
  const text = JSON.stringify(profile).toLowerCase();
  const scored = THEME_IDS.map((themeId) => {
    const meta = THEME_META[themeId];
    let score = preferredThemes.includes(themeId) ? 20 : 0;
    if (meta.aliases.some((alias) => text.includes(alias))) score += 10;
    return { themeId, score };
  }).sort((a, b) => b.score - a.score);

  return scored
    .map((item) => item.themeId)
    .concat(["minimal-white", "editorial-magazine", "mono-luxury"])
    .filter((themeId, index, array) => THEME_IDS.includes(themeId) && array.indexOf(themeId) === index)
    .slice(0, 3)
    .map((themeId) => ({
      themeId,
      reason: `Ten kierunek pasuje do profilu marki i pozwala zbudować spójny, czytelny wizerunek w branży ${safeString(profile.industry, 120) || "firmy"}.`,
      colors: THEME_META[themeId].colors,
      fontMood: THEME_META[themeId].fontMood,
    }));
};

const normalizeNameIdeas = (value: Record<string, unknown>, fallback: CompanyNameIdea[]): CompanyNameIdea[] => {
  const rawIdeas = Array.isArray(value.names)
    ? value.names
    : Array.isArray(value.ideas)
      ? value.ideas
      : Array.isArray(value.nameIdeas)
        ? value.nameIdeas
        : [];
  const seen = new Set<string>();
  const bannedNamePatterns = [
    /usługa\s|usluga\s/i,
    /automatyzacji\s/i,
    /flow works/i,
    /skanerai/i,
    /prostoai/i,
    /automatik/i,
    /automatika/i,
    /optymalni/i,
    /^(auto|smart|pro|expert|flow|works|lab|studio)\s/i,
  ];
  const ideas = rawIdeas
    .map((item: any) => ({
      name: safeString(item?.name, 80),
      style: safeString(item?.style || item?.category, 80),
      reason: safeString(item?.reason, 300),
      caution: safeString(item?.caution || item?.risk, 200),
    }))
    .filter((item: CompanyNameIdea) => {
      const key = item.name.toLowerCase();
      if (!item.name || item.name.length < 3 || seen.has(key)) return false;
      if (bannedNamePatterns.some((pattern) => pattern.test(item.name))) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  return ideas.length ? ideas : fallback;
};

export const companyAssistantRouter = Router();
companyAssistantRouter.use("/company-assistant", requireAuthenticatedUser, requireAdminUser);

companyAssistantRouter.post("/company-assistant/generate-names", requireAuthenticatedUser, async (request, response) => {
  try {
    const description = safeString(request.body?.description, 4000);
    const profile = request.body?.profile && typeof request.body.profile === "object" && !Array.isArray(request.body.profile)
      ? request.body.profile as Record<string, unknown>
      : {};
    const preferredStyles = Array.isArray(request.body?.preferredStyles)
      ? request.body.preferredStyles.map((item: unknown) => safeString(item, 80)).filter(Boolean).slice(0, 8)
      : [];

    const fallback: CompanyNameIdea[] = [
      { name: "Nazwa robocza do dopracowania", style: "Fallback", reason: "Model nazw nie odpowiedział poprawnie — warto doprecyzować branżę i ofertę." },
    ];

    const prompt = `Jesteś topowym strategiem namingowym i brand strategistą dla małych firm w Polsce.
Masz stworzyć nazwy firmy na poziomie profesjonalnej agencji brandingowej.

KONTEKST:
Opis użytkownika: ${description || "brak"}
Profil / brief: ${JSON.stringify(profile)}
Preferowane style: ${preferredStyles.join(", ") || "brak"}

ZADANIE:
Zaproponuj 12 mocnych nazw firmy po polsku lub łatwych do wymówienia w Polsce.
To mają być nazwy, które mogą realnie trafić na logo, wizytówkę i stronę www.

Kategorie muszą być wymieszane:
- 3 nazwy brandowe / abstrakcyjne, ale czytelne i łatwe do wymówienia
- 3 nazwy polskie / naturalne, z charakterem
- 2 nazwy premium / eksperckie
- 2 nazwy krótkie, maksymalnie 2 sylaby lub 8 znaków jeśli to możliwe
- 2 nazwy opisowe, ale nie banalne

Twarde zakazy:
- NIE twórz nazw typu "Usługa Flow", "Auto Automatyzacji", "Flow Works", "Nexa Usługa".
- NIE sklejaj losowo polskiego rzeczownika z angielskim buzzwordem.
- NIE używaj generyków: Pro, Expert, Studio, Flow, Works, Lab jako głównego pomysłu, chyba że nazwa naprawdę brzmi markowo.
- NIE dodawaj "AI" na końcu nazwy jako prostego skrótu, chyba że nazwa bez tego nie ma sensu.
- NIE twórz nazw typu "SkanerAI", "ProstoAI", "Automatik", "Automatika", "Optymalni", "Automatyzacje Pro".
- NIE twórz nazw brzmiących jak tłumaczenie z generatora albo placeholder.
- NIE wymyślaj nazw trudnych do wymówienia po polsku.
- NIE używaj nazw znanych marek.
- Nazwy mają brzmieć jak realne marki, nie jak placeholdery.

Reguły jakości:
- Każda nazwa ma mieć własny charakter, nie tylko opisywać usługę.
- Nazwa powinna dobrze wyglądać w logo jako wordmark.
- Unikaj zbyt dosłownych nazw, jeśli brzmią tanio.
- Dla branży automatyzacji/AI preferuj skojarzenia: porządek, tempo, system, sprawność, mniej chaosu, proces, wynik, lekkość obsługi.
- Dla każdej nazwy oceń ją mentalnie w skali 1-10. Zwracaj tylko nazwy 8/10 albo lepsze.
- Jeśli pierwsze pomysły są generyczne, odrzuć je i wymyśl kolejne.

Dla każdej nazwy podaj:
- name
- style
- reason: dlaczego pasuje do tej konkretnej firmy
- caution: krótka uwaga co sprawdzić lub potencjalne ryzyko

Odpowiedz wyłącznie JSON:
{
  "names": [
    { "name": "...", "style": "...", "reason": "...", "caution": "..." }
  ]
}`;

    let ideas = fallback;
    try {
      const llm = await runJsonLlm(prompt, 0.75);
      ideas = normalizeNameIdeas(llm, fallback);
    } catch {
      ideas = fallback;
    }

    response.json({ ok: true, names: ideas });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Failed to generate company names." });
  }
});

companyAssistantRouter.post("/company-assistant/analyze-brief", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const description = safeString(request.body?.description, 4000);
    const requestedStartMode = safeString(request.body?.startMode, 80) as StartMode;
    const startMode = START_MODES.includes(requestedStartMode) ? requestedStartMode : "idea-only";
    const sessionId = safeString(request.body?.sessionId, 120);
    const forceNewSession = request.body?.forceNew === true;

    if (!description) {
      response.status(400).json({ ok: false, message: "Brak opisu firmy lub pomysłu." });
      return;
    }

    const fallback = fallbackAnalyzeBrief(description, [], startMode);
    let analysis = fallback;

    const prompt = `Jesteś ekspertem od brandingu małych firm w Polsce. Przeanalizuj opis i zwróć wyłącznie JSON.
Zasady:
- stage: existing, starting, idea albo exploring.
- detectedIndustry: konkretnie po polsku.
- knownFacts: tylko fakty z opisu.
- missingFields: max 6 z listy: targetAudience, specialization, differentiator, offer, tone, cta, companyName, location, avoidList.
- recommendedMaterials: 2-4 z listy: ${MATERIAL_IDS.join(", ")}.
- recommendedThemes: 3 z listy: ${THEME_IDS.join(", ")}.
- acknowledgement: jedno konkretne zdanie po polsku.
- confidence: 0-1.
- warnings: tablica.
Scenariusz startowy wybrany przez użytkownika: ${startMode}
Instrukcja dla scenariusza: ${startModeInstruction(startMode)}
Opis użytkownika: ${description}`;

    try {
      const llm = await runJsonLlm(`${prompt}

ULEPSZONE REGUŁY ANALIZY:
- Wyciągaj z opisu możliwie dużo faktów do knownFacts: companyName, logoStatus, logoStyle, brandMood, targetAudience, specialization, offer, differentiator, tone, cta, location, avoidList, customerProblem, mainMessage, visualDirection.
- missingFields może mieć do 8 pól i ma pomijać informacje już podane w knownFacts.
- Automatyzacje, procesy, AI, Make, Zapier, n8n, workflow klasyfikuj jako Automatyzacje biznesowe / AI.
- Remont, wykończenia, elektryka, malowanie, tapetowanie klasyfikuj jako Firma remontowo-wykończeniowa lub pokrewna.
- Forex, trading, inwestowanie, edukacja inwestycyjna klasyfikuj jako Edukacja finansowa / trading.
- Jeśli użytkownik podaje kilka usług w jednej branży, traktuj je jako zakres oferty, nie konflikt.
- Dobieraj style branżowo: automations-ai/tech-blue dla AI, construction-premium dla budowlanki, finance-navy-gold dla finansów, salon-champagne dla beauty, medical-trust dla medycznych.
- Jeśli scenariusz to exploring-niche, recommendedMaterials MUSI preferować niche-map i concept-visualization.
- Jeśli scenariusz to idea-only, nie zakładaj istnienia firmy, logo ani gotowej nazwy.
- Jeśli scenariusz to rebrand, missingFields ma zawierać informacje o tym, co zostawić i czego unikać, jeśli nie wynika to z opisu.

Dodatkowe reguły jakości:
${BRAND_ANALYSIS_GUARDRAILS}`, 0.3);
      analysis = normalizeAnalysis(llm, fallback);
      analysis.knownFacts = { startMode, ...analysis.knownFacts };
      analysis = attachBriefQuality(analysis);
    } catch (error) {
      analysis = { ...fallback, warnings: [...fallback.warnings, "fallback-heuristic"] };
    }

    const existing = !forceNewSession && sessionId ? await getLocalCompanyAssistantSession(user.id, sessionId) : null;
    const session = existing
      ? await updateLocalCompanyAssistantSession(user.id, existing.id, { description, analysis, answers: [], profile: {}, status: "in_progress" })
      : await createLocalCompanyAssistantSession({ userId: user.id, description, analysis, answers: [], profile: {}, status: "in_progress" });

    response.json({ ok: true, sessionId: session?.id, ...analysis });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Failed to analyze company brief." });
  }
});

companyAssistantRouter.post("/company-assistant/next-question", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const sessionId = safeString(request.body?.sessionId, 120);
    const session = sessionId ? await getLocalCompanyAssistantSession(user.id, sessionId) : null;
    const analysis = normalizeAnalysis(
      (request.body?.analysis && typeof request.body.analysis === "object" ? request.body.analysis : session?.analysis || {}) as Record<string, unknown>,
      fallbackAnalyzeBrief(session?.description || ""),
    );
    const answers = Array.isArray(request.body?.answers)
      ? request.body.answers.map((item: any) => ({
          field: safeString(item?.field, 80),
          question: safeString(item?.question, 500),
          answer: safeString(item?.answer, 1000) || "skipped",
        })).filter((item: CompanyAssistantAnswer) => item.field && item.question)
      : [];
    const questionNumber = Math.max(1, Number(request.body?.questionNumber || answers.length + 1));
    const fallback = fallbackNextQuestion(analysis, answers, questionNumber);
    let result = fallback;

    if (!fallback.done) {
      const prompt = `Jesteś asystentem brandingowym. Zadaj jedno kolejne pytanie. Nie pytaj o dane z knownFacts ani answers. Pytanie ma być konkretne dla branży. Jedno pytanie, 3-5 quickReplies. Jeśli komplet danych lub questionNumber > 5, zwróć done true z profileDraft.
Odpowiedz wyłącznie JSON zgodny z: {done:boolean, question?:{field,text,quickReplies,allowCustom,allowSkip}, estimatedRemaining?:number, profileDraft?:object}
Analiza: ${JSON.stringify(analysis)}
Odpowiedzi: ${JSON.stringify(answers)}
Numer pytania: ${questionNumber} z maksymalnie 5.`;

      try {
        const llm = await runJsonLlm(`${prompt}

ULEPSZONE REGUŁY PYTAŃ:
- Pytanie ma dotyczyć jednego konkretnego pola: targetAudience, specialization, offer, differentiator, tone, cta, location, avoidList, brandMood albo logoStyle.
- Nie zadawaj pytań o informacje, które są już w knownFacts albo answers.
- quickReplies: 5-8 krótkich, konkretnych opcji gotowych do kliknięcia.
- Dla budowlanki: malowanie, tapetowanie, elektryka, wykończenia pod klucz, deweloperzy, terminowość, gwarancja.
- Dla automatyzacji: oszczędność czasu, automatyzacja sprzedaży, CRM, chatboty AI, Make, Zapier, n8n, szkolenia.
- Dla finansów: edukacja, analiza rynku, forex, trading, kurs online, konsultacje.
- Dla beauty: premium, metamorfozy, zabiegi, rezerwacje, Instagram, kobiety 25-45.
- Jeśli odpowiedź była skipped, nie wracaj do tego pola.`, 0.6);
        result = normalizeNextQuestion(llm, fallback, analysis, answers, questionNumber);
      } catch {
        result = fallback;
      }
    }

    if (session) {
      await updateLocalCompanyAssistantSession(user.id, session.id, {
        answers,
        profile: result.done ? result.profileDraft || buildProfileDraft(analysis, answers) : session.profile,
        status: result.done ? "completed" : "in_progress",
      });
    }

    response.json({ ok: true, ...result });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Failed to build next company question." });
  }
});

companyAssistantRouter.post("/company-assistant/recommend-styles", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const sessionId = safeString(request.body?.sessionId, 120);
    const profile = request.body?.profile && typeof request.body.profile === "object" ? request.body.profile as Record<string, unknown> : {};
    const session = sessionId ? await getLocalCompanyAssistantSession(user.id, sessionId) : null;
    const preferredThemes = Array.isArray(session?.analysis?.recommendedThemes) ? session.analysis.recommendedThemes.map((item) => safeString(item, 80)) : [];
    let recommendations = styleRecommendationsFor(profile, preferredThemes);

    const prompt = `Jesteś art directorem. Wybierz 3 style z listy: ${THEME_IDS.join(", ")}.
Zwróć wyłącznie JSON: {recommendations:[{themeId,reason,colors,fontMood}]}.
fontMood: elegancki, nowoczesny, odważny, klasyczny, magazynowy.
Style mają się różnić klimatem.
Profil firmy: ${JSON.stringify(profile)}`;

    try {
      const llm = await runJsonLlm(prompt, 0.4);
      const raw = Array.isArray(llm.recommendations) ? llm.recommendations : [];
      const normalized = raw.map((item: any) => {
        const requestedThemeId = safeString(item?.themeId, 80);
        const themeId = THEME_IDS.includes(requestedThemeId) ? requestedThemeId : recommendations[0]?.themeId || "minimal-white";
        const meta = THEME_META[themeId];
        const fontMood = ["elegancki", "nowoczesny", "odważny", "klasyczny", "magazynowy"].includes(item?.fontMood) ? item.fontMood as FontMood : meta.fontMood;
        return {
          themeId,
          reason: safeString(item?.reason, 240) || `Pasuje do profilu marki ${safeString(profile.industry, 120) || ""}.`,
          colors: Array.isArray(item?.colors) ? item.colors.map((color: unknown) => safeString(color, 20)).filter(Boolean).slice(0, 5) : meta.colors,
          fontMood,
        };
      }).filter((item: StyleRecommendation, index: number, array: StyleRecommendation[]) => array.findIndex((other) => other.themeId === item.themeId) === index).slice(0, 3);
      if (normalized.length === 3) recommendations = normalized;
    } catch {
      // fallback intentionally kept
    }

    if (session) {
      await updateLocalCompanyAssistantSession(user.id, session.id, {
        profile,
        selectedTheme: recommendations[0]?.themeId || session.selected_theme,
      });
    }

    response.json({ ok: true, recommendations });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Failed to recommend company styles." });
  }
});
