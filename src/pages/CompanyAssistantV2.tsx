import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BriefcaseBusiness, Check, ChevronDown, Copy, Download, Loader2, Save, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { vpsFetch } from '@/lib/vpsApi';

type Stage = 'existing' | 'starting' | 'idea' | 'exploring';
type StartMode = 'existing-business' | 'starting-business' | 'idea-only' | 'exploring-niche' | 'rebrand';
type FontMood = 'elegancki' | 'nowoczesny' | 'odważny' | 'klasyczny' | 'magazynowy';
type PdfDocument = import('jspdf').jsPDF;

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
  level: 'weak' | 'medium' | 'strong';
  strengths: string[];
  gaps: string[];
  suggestions: string[];
  conflicts: string[];
};

type Answer = {
  field: string;
  question: string;
  answer: string;
};

type AssistantQuestion = {
  field: string;
  text: string;
  quickReplies: string[];
  allowCustom: boolean;
  allowSkip: boolean;
};

type NextQuestionResponse = {
  ok: boolean;
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

type MaterialTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  format: '1:1' | '16:9' | 'banner-wide' | 'business-card' | '9:16' | '2:3' | '4:5' | 'a4-poster' | 'story' | 'linkedin-post';
  style: 'realistic' | 'illustration' | 'abstract' | 'pixel-art' | 'watercolor' | 'neon';
  promptGoal: string;
  sections: string[];
};

type MaterialVariant = {
  id: string;
  title: string;
  description: string;
  promptInstruction: string;
};

type LogoPromptStyleId = 'symbol-wordmark' | 'wordmark' | 'monogram' | 'emblem' | 'abstract-mark' | 'letter-symbol';
type LogoTextMode = 'company-name' | 'symbol-only' | 'monogram';
type LiteLogoStyle = 'symbol-wordmark' | 'typographic-wordmark' | 'lettermark';
type AssistantMode = 'lite' | 'advanced';
type LiteStep = 'describe' | 'name' | 'material' | 'style' | 'prompt';

type NameIdea = {
  name: string;
  style: string;
  reason: string;
  caution?: string;
};

type SloganIdea = {
  text: string;
  style: string;
  useCase: string;
};

type SavedMaterialPrompt = {
  materialId: string;
  title: string;
  format: string;
  style: string;
  prompt: string;
};

type SavedCompanyAssistantPackage = {
  id: string;
  createdAt: string;
  companyName: string;
  industry: string;
  profile: Record<string, string>;
  prompts: SavedMaterialPrompt[];
};

type SavedCompanyAssistantAsset = {
  id: string;
  packageId?: string | null;
  sessionId?: string | null;
  graphicId?: string | null;
  url?: string | null;
  signedUrl?: string | null;
  materialId: string;
  materialTitle: string;
  assetType: string;
  prompt: string;
  dimensions?: string | null;
  createdAt: string;
};

type ConversationStep = 'describe' | 'analyzing' | 'questions' | 'brand' | 'contact' | 'styles' | 'mirror' | 'materials' | 'logo' | 'prompts';

const SESSION_STORAGE_KEY = 'companyAssistantV2SessionId';

const flowSteps: Array<{ id: ConversationStep; label: string }> = [
  { id: 'describe', label: 'Opis' },
  { id: 'analyzing', label: 'Analiza' },
  { id: 'questions', label: 'Pytania' },
  { id: 'brand', label: 'Nazwa i logo' },
  { id: 'contact', label: 'Kontakt' },
  { id: 'styles', label: 'Styl' },
  { id: 'mirror', label: 'Brief' },
  { id: 'materials', label: 'Materiały' },
  { id: 'logo', label: 'Styl logo' },
  { id: 'prompts', label: 'Prompty' },
];

const materialEstimatedCosts: Record<string, number> = {
  'logo-concept': 50,
  'business-card': 60,
  brandbook: 60,
  'offer-flyer': 60,
  'instagram-post': 60,
  'story-reels-cover': 60,
  'linkedin-post': 60,
  'ad-banner': 60,
  'price-list': 60,
  voucher: 60,
  'company-starter-pack': 60,
  'niche-map': 60,
  'concept-visualization': 60,
};

const liteMaterialIds = ['logo-concept', 'business-card', 'instagram-post', 'offer-flyer', 'brandbook', 'ad-banner'];
const materialIdsRequiringCompanyName = new Set(['logo-concept', 'business-card', 'brandbook', 'offer-flyer', 'price-list', 'voucher']);

const liteStyleOptions = [
  { id: 'minimal-white', label: 'Minimal', helper: 'czysto, jasno, bez chaosu' },
  { id: 'premium-black-gold', label: 'Premium', helper: 'elegancko, kontrastowo' },
  { id: 'automations-ai', label: 'Tech / AI', helper: 'nowocześnie, cyfrowo' },
  { id: 'local-friendly', label: 'Lokalny', helper: 'przyjaźnie i prosto' },
  { id: 'bold-agency', label: 'Odważny', helper: 'mocny marketingowo' },
  { id: 'clean-medical-beauty', label: 'Beauty clean', helper: 'delikatnie i estetycznie' },
];

const logoPromptStyles: Array<{
  id: LogoPromptStyleId;
  title: string;
  subtitle: string;
  bestFor: string;
  promptInstruction: string;
  avoid: string;
  preview: string;
}> = [
  {
    id: 'symbol-wordmark',
    title: 'Znak + nazwa',
    subtitle: 'Najbardziej uniwersalne',
    bestFor: 'firmy usługowe, lokalne, B2B, nowe marki',
    promptInstruction: 'Create one logo composed of a simple distinctive symbol placed next to the exact company name wordmark.',
    avoid: 'no extra slogan, no contact details, no logo sheet, no multiple variants',
    preview: '◼ Nazwa',
  },
  {
    id: 'wordmark',
    title: 'Sama nazwa / wordmark',
    subtitle: 'Czyste i premium',
    bestFor: 'marki eksperckie, software, beauty premium, konsulting',
    promptInstruction: 'Create one refined wordmark logo using only the exact company name as the visible logo text.',
    avoid: 'no separate icon, no tagline, no decorative clutter, no presentation board',
    preview: 'Nazwa',
  },
  {
    id: 'monogram',
    title: 'Monogram',
    subtitle: 'Inicjały marki',
    bestFor: 'krótkie nazwy, marki osobiste, premium, kancelarie',
    promptInstruction: 'Create one monogram logo based on the initials of the company name, with the company name optional and secondary.',
    avoid: 'no random letters, no long paragraph, no icon library look, no multiple versions',
    preview: 'NM',
  },
  {
    id: 'emblem',
    title: 'Emblemat / badge',
    subtitle: 'Znak w ramce',
    bestFor: 'gastro, barber, tattoo, kluby, marki rzemieślnicze',
    promptInstruction: 'Create one compact emblem logo where the symbol and brand name are integrated inside a simple badge or seal.',
    avoid: 'no overly detailed coat of arms, no tiny unreadable text, no vintage noise unless requested',
    preview: '◎',
  },
  {
    id: 'abstract-mark',
    title: 'Abstrakcyjny znak',
    subtitle: 'Nowoczesny symbol',
    bestFor: 'AI, automatyzacje, tech, aplikacje, startupy',
    promptInstruction: 'Create one modern abstract brand mark with a clean geometric symbol and a simple wordmark.',
    avoid: 'no generic AI brain unless explicitly relevant, no gradients overload, no fake 3D mockup',
    preview: '◆ Nazwa',
  },
  {
    id: 'letter-symbol',
    title: 'Litera jako symbol',
    subtitle: 'Pierwsza litera + nazwa',
    bestFor: 'proste marki, usługi lokalne, nieruchomości, edukacja',
    promptInstruction: 'Create one logo where the first letter of the company name becomes a distinctive symbol, paired with the exact company name.',
    avoid: 'no random unrelated pictogram, no extra initials, no complicated illustration',
    preview: 'A Nazwa',
  },
];

const getLogoPromptStyle = (id?: string) =>
  logoPromptStyles.find((style) => style.id === id) || logoPromptStyles[0];

const nameStyleOptions = [
  'Premium',
  'Prosta i czytelna',
  'Nowoczesna',
  'Lokalna',
  'Ekspercka',
  'Kreatywna',
  'Krótka',
];

const sanitizeNameWord = (value?: string) =>
  String(value || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[@#]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !['firma', 'firmy', 'marka', 'marki', 'usługi', 'uslug', 'online', 'oraz', 'dla', 'jestem', 'chce', 'chcę'].includes(word.toLowerCase()))
    .slice(0, 4);

const titleCaseName = (value: string) =>
  value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

function generateCompanyNameIdeas(profile: Record<string, string>, description: string, preferredStyles: string[]): NameIdea[] {
  const rawIndustry = profile.industry || profile.specialization || profile.offer || description || 'marka';
  const rawOffer = profile.offer || profile.specialization || rawIndustry;
  const rawAudience = profile.targetAudience || profile.customerProblem || '';
  const words = [
    ...sanitizeNameWord(rawOffer),
    ...sanitizeNameWord(rawIndustry),
    ...sanitizeNameWord(rawAudience),
  ];
  const uniqueWords = Array.from(new Set(words.map(titleCaseName))).slice(0, 5);
  const main = uniqueWords[0] || 'Nova';
  const second = uniqueWords.find((word) => word !== main) || 'Studio';
  const industryLower = rawIndustry.toLowerCase();
  const isTech = /ai|automaty|software|aplik|tech|proces|make|zapier/.test(industryLower);
  const isBeauty = /beauty|salon|fryz|kosmet|paznok|medyc/.test(industryLower);
  const isRealEstate = /nieruch|estate|dom|mieszka/.test(industryLower);
  const isTattoo = /tatua|tattoo|ink/.test(industryLower);
  const isGastro = /gastro|kawiar|restaur|food|kuch/.test(industryLower);
  const wantsPremium = preferredStyles.includes('Premium') || /premium|luksus|elegan/.test(`${profile.tone || ''} ${profile.brandMood || ''}`.toLowerCase());
  const wantsSimple = preferredStyles.includes('Prosta i czytelna') || preferredStyles.includes('Krótka');

  const suffixes = isTech
    ? ['Flow', 'Pilot', 'Works', 'Logic', 'Ops']
    : isBeauty
      ? ['Studio', 'Atelier', 'Glow', 'Clinic', 'Lab']
      : isRealEstate
        ? ['Estate', 'Home', 'Property', 'House', 'Space']
        : isTattoo
          ? ['Ink', 'Tattoo', 'Atelier', 'Line', 'Mark']
          : isGastro
            ? ['Cafe', 'Food', 'Bistro', 'Taste', 'House']
            : ['Studio', 'Pro', 'Lab', 'Works', 'Point'];

  const prefixes = wantsPremium
    ? ['Prime', 'Noble', 'Luma', 'Verde', 'Aurum']
    : isTech
      ? ['Auto', 'Flow', 'Nexa', 'Opti', 'Logic']
      : ['Nova', 'Milo', 'Forma', 'Lokal', 'Craft'];

  const candidates: NameIdea[] = [
    {
      name: `${main} ${suffixes[0]}`,
      style: 'Opisowa',
      reason: 'Łączy główne słowo z branży z prostym dopiskiem, więc jest czytelna w logo i na wizytówce.',
    },
    {
      name: `${prefixes[0]} ${second}`,
      style: wantsPremium ? 'Premium' : 'Nowoczesna',
      reason: 'Brzmi bardziej markowo i zostawia miejsce na rozwój oferty.',
    },
    {
      name: `${main}${suffixes[1] || 'Pro'}`,
      style: 'Krótka',
      reason: 'Krótka nazwa jest łatwiejsza do zapamiętania i lepiej działa w znaku graficznym.',
    },
    {
      name: `${prefixes[1] || 'Nova'} ${suffixes[2] || 'Studio'}`,
      style: isTech ? 'Technologiczna' : 'Uniwersalna',
      reason: 'Daje profesjonalny, szeroki kierunek bez zamykania marki w jednej usłudze.',
    },
    {
      name: `${second} ${wantsSimple ? 'Pro' : suffixes[3] || 'Lab'}`,
      style: 'Ekspercka',
      reason: 'Pasuje do marki, która chce wyglądać konkretnie i usługowo.',
    },
    {
      name: `${prefixes[2] || 'Forma'} ${main}`,
      style: 'Kreatywna',
      reason: 'Ma bardziej brandingowy charakter i może dobrze wyglądać w minimalistycznym logo.',
    },
  ];

  const seen = new Set<string>();
  return candidates
    .map((item) => ({ ...item, name: item.name.replace(/\s+/g, ' ').trim() }))
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key) || item.name.length < 4) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function generateSloganIdeas(profile: Record<string, string>, archetypeId: string): SloganIdea[] {
  const archetype = brandArchetypes.find((item) => item.id === archetypeId);
  const industry = profile.industry || profile.specialization || 'Twojej branży';
  const offer = profile.offer || profile.specialization || 'Twojej oferty';
  const audience = profile.targetAudience || 'Twoich klientów';
  const differentiator = profile.differentiator || profile.mainMessage || 'lepszego efektu';
  const cta = profile.cta || 'Napisz do nas';
  const isTech = /ai|automaty|software|aplik|tech|proces|make|zapier/.test(`${industry} ${offer}`.toLowerCase());
  const isLocal = /lokal|budowl|remont|gastro|salon|beauty|fryz|tatua/.test(`${industry} ${offer}`.toLowerCase());

  const base: SloganIdea[] = [
    {
      text: isTech ? 'Mniej ręcznej pracy. Więcej sprawczości.' : `Profesjonalnie dla ${audience}.`,
      style: 'Krótki claim',
      useCase: 'pod logo, wizytówka, stopka oferty',
    },
    {
      text: `Pomagamy zamienić ${offer} w konkretny rezultat.`,
      style: 'Ekspercki',
      useCase: 'strona www, LinkedIn, oferta PDF',
    },
    {
      text: `${differentiator}. Bez chaosu.`,
      style: 'Mocny sprzedażowy',
      useCase: 'reklama, baner, post promocyjny',
    },
    {
      text: isLocal ? 'Rzetelnie, estetycznie, na czas.' : 'Prościej. Czytelniej. Skuteczniej.',
      style: 'Prosty i ludzki',
      useCase: 'ulotka, wizytówka, materiały lokalne',
    },
    {
      text: archetype?.id === 'premium-guide' ? 'Detal, który buduje zaufanie.' : `Twoja marka w ${industry} — jasno i profesjonalnie.`,
      style: archetype?.title || 'Markowy',
      useCase: 'brandbook, opis marki, nagłówek',
    },
    {
      text: `${cta} — zrobimy pierwszy krok prosto.`,
      style: 'CTA',
      useCase: 'grafika social media, landing, oferta',
    },
  ];

  const seen = new Set<string>();
  return base
    .map((item) => ({ ...item, text: item.text.replace(/\s+/g, ' ').trim() }))
    .filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key) || item.text.length < 8) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

const startModes: Array<{
  id: StartMode;
  title: string;
  subtitle: string;
  helper: string;
  placeholder: string;
  examples: string[];
  focus: string[];
}> = [
  {
    id: 'existing-business',
    title: 'Mam firmę',
    subtitle: 'Firma już działa',
    helper: 'Najpierw zbiorę aktualną ofertę, klienta, wyróżnik i materiały, których potrzebujesz.',
    placeholder: 'np. Prowadzę studio tatuażu od 3 lat w Krakowie. Chcę wyglądać bardziej profesjonalnie i przyciągać klientów na autorskie projekty.',
    examples: [
      'Prowadzę studio tatuażu od 3 lat, chcę wyglądać bardziej profesjonalnie.',
      'Mam firmę remontową: malowanie, tapetowanie i elektryka. Chcę ofertę premium dla deweloperów.',
      'Prowadzę szkolenia z automatyzacji AI dla małych firm. Potrzebuję lepszej identyfikacji i materiałów sprzedażowych.',
    ],
    focus: ['oferta', 'klient', 'wyróżnik', 'materiały'],
  },
  {
    id: 'starting-business',
    title: 'Zakładam firmę',
    subtitle: 'Startujesz z marką',
    helper: 'Pomogę poukładać nazwę, pierwszą ofertę, styl logo i pakiet materiałów startowych.',
    placeholder: 'np. Otwieram salon beauty w Warszawie. Nie mam jeszcze pełnej identyfikacji, chcę wizytówki, posty i elegancki styl.',
    examples: [
      'Otwieram salon beauty i potrzebuję wizytówek oraz postów na Instagram.',
      'Zakładam lokalną kawiarnię specialty. Chcę ciepły, rzemieślniczy styl i materiały na otwarcie.',
      'Startuję z usługą automatyzacji procesów dla sklepów internetowych, nie mam jeszcze logo.',
    ],
    focus: ['nazwa', 'logo', 'pierwsza oferta', 'pakiet startowy'],
  },
  {
    id: 'idea-only',
    title: 'Mam tylko pomysł',
    subtitle: 'Jeszcze bez firmy',
    helper: 'Nie będę pytać jak działającą firmę — najpierw doprecyzujemy koncept, odbiorcę i wizualizację.',
    placeholder: 'np. Mam pomysł na mobilną kawiarnię, ale nie mam jeszcze nazwy ani logo. Chcę zobaczyć kierunek marki i sprawdzić, czy to ma sens.',
    examples: [
      'Mam pomysł na mobilną kawiarnię, ale nie mam jeszcze nazwy ani logo.',
      'Myślę o marce z gotowymi automatyzacjami dla freelancerów, ale dopiero szukam formy oferty.',
      'Chcę stworzyć magazyn o piłce nożnej, jeszcze nie wiem jaki styl i materiały będą najlepsze.',
    ],
    focus: ['koncept', 'odbiorca', 'nazwa robocza', 'wizualizacja'],
  },
  {
    id: 'exploring-niche',
    title: 'Szukam niszy',
    subtitle: 'Nie wiem, co wybrać',
    helper: 'Zamiast wizytówki od razu zrobimy mapę nisz, propozycje kierunków i pierwszą wizualizację testową.',
    placeholder: 'np. Chcę wejść w biznes online związany z AI, ale nie wiem czy lepsze są szkolenia, automatyzacje, gotowe prompty czy usługi dla firm.',
    examples: [
      'Szukam niszy w AI dla małych firm. Chcę pomysły na ofertę i wizualizację marki.',
      'Nie wiem, czy iść w nieruchomości, finanse czy automatyzacje. Chcę porównać pomysły.',
      'Chcę znaleźć niszę pod social media i produkt cyfrowy, ale nie mam jeszcze konkretnej oferty.',
    ],
    focus: ['nisze', 'potencjał', 'pierwsza oferta', 'test rynku'],
  },
  {
    id: 'rebrand',
    title: 'Odświeżam markę',
    subtitle: 'Nowy wygląd dla istniejącej firmy',
    helper: 'Skupimy się na tym, co zostaje, co zmienić i jak nie zgubić rozpoznawalności marki.',
    placeholder: 'np. Mam logo i stronę, ale wyglądają amatorsko. Chcę odświeżyć markę, zostawić nazwę i zrobić lepszy brandbook.',
    examples: [
      'Mam logo, ale wygląda stare. Chcę odświeżyć markę i przygotować nowy brandbook.',
      'Firma działa od kilku lat, ale materiały są niespójne. Chcę uporządkować kolory, fonty i szablony.',
      'Chcę przejść z lokalnego wyglądu na bardziej premium, bez zmiany nazwy firmy.',
    ],
    focus: ['co zostaje', 'co zmienić', 'styl premium', 'spójność'],
  },
];

const logoStatusOptions = [
  'Mam gotowe logo',
  'Mam logo, ale chcę je odświeżyć',
  'Nie mam logo',
  'Chcę, żeby AI zaproponowało kierunek',
];

const logoStyleOptions = [
  'Minimalistyczne',
  'Typograficzne',
  'Z ikoną / symbolem',
  'Premium',
  'Nowoczesne',
  'Odważne',
  'Eleganckie',
  'Lokalne i przyjazne',
];

const brandMoodOptions = [
  'Profesjonalnie',
  'Premium',
  'Nowocześnie',
  'Przyjaźnie',
  'Ekspercko',
  'Odważnie',
  'Czysto i minimalistycznie',
  'Energetycznie',
];

const brandArchetypes = [
  {
    id: 'expert',
    title: 'Ekspert',
    subtitle: 'Wiedza, konkrety, zaufanie',
    bestFor: 'doradcy, B2B, edukacja, finanse, automatyzacje',
    tone: 'ekspercki, konkretny, spokojny',
    promptHint: 'Brand should communicate expertise, precision, trust and practical outcomes.',
  },
  {
    id: 'premium-guide',
    title: 'Premium doradca',
    subtitle: 'Elegancja, selektywność, wysoka jakość',
    bestFor: 'usługi premium, nieruchomości, beauty, konsulting',
    tone: 'premium, pewny, elegancki',
    promptHint: 'Brand should feel premium, refined, selective and high-value.',
  },
  {
    id: 'local-trusted',
    title: 'Lokalny zaufany',
    subtitle: 'Bliskość, prostota, rzetelność',
    bestFor: 'firmy lokalne, budowlanka, gastro, usługi',
    tone: 'ludzki, prosty, rzetelny',
    promptHint: 'Brand should feel trustworthy, local, clear, friendly and reliable.',
  },
  {
    id: 'innovator',
    title: 'Innowator',
    subtitle: 'Nowoczesność, szybkość, technologia',
    bestFor: 'AI, SaaS, automatyzacje, aplikacje, startup',
    tone: 'nowoczesny, dynamiczny, techniczny',
    promptHint: 'Brand should feel innovative, efficient, digital and future-oriented.',
  },
  {
    id: 'creator',
    title: 'Kreatywne studio',
    subtitle: 'Styl, charakter, odwaga',
    bestFor: 'tattoo, design, social media, fotografia, moda',
    tone: 'kreatywny, wyrazisty, pewny siebie',
    promptHint: 'Brand should feel creative, distinctive, memorable and visually bold.',
  },
  {
    id: 'mentor',
    title: 'Mentor / edukator',
    subtitle: 'Pomoc, prosty język, prowadzenie',
    bestFor: 'kursy, szkolenia, coaching, edukacja finansowa',
    tone: 'wspierający, klarowny, motywujący',
    promptHint: 'Brand should feel helpful, educational, clear and encouraging.',
  },
];

const visualThemes = [
  { id: 'premium-black-gold', title: 'Premium Black & Gold', description: 'Luksusowy kontrast i złote akcenty.', colors: ['#111111', '#f7f2e8', '#c9a227', '#ffffff'], fontMood: 'elegancki' as FontMood },
  { id: 'minimal-white', title: 'Minimal White', description: 'Czysto, jasno i bardzo czytelnie.', colors: ['#ffffff', '#111827', '#e5e7eb', '#9ca3af'], fontMood: 'nowoczesny' as FontMood },
  { id: 'luxury-real-estate', title: 'Luxury Real Estate', description: 'Elegancki styl premium.', colors: ['#0f172a', '#ffffff', '#d6b46a', '#94a3b8'], fontMood: 'elegancki' as FontMood },
  { id: 'bold-agency', title: 'Bold Agency', description: 'Mocny, nowoczesny styl marketingowy.', colors: ['#111827', '#ec4899', '#38bdf8', '#ffffff'], fontMood: 'odważny' as FontMood },
  { id: 'local-friendly', title: 'Local Friendly', description: 'Ciepły, prosty, lokalny klimat.', colors: ['#fbf7ef', '#2f3e2f', '#d88945', '#ffffff'], fontMood: 'klasyczny' as FontMood },
  { id: 'clean-medical-beauty', title: 'Clean Beauty / Medical', description: 'Delikatny styl beauty i zdrowie.', colors: ['#ffffff', '#d8b4a0', '#7f8c8d', '#f5f5f4'], fontMood: 'elegancki' as FontMood },
  { id: 'tattoo-dark-ink', title: 'Tattoo Dark Ink', description: 'Ciemny, kontrastowy klimat studia tatuażu.', colors: ['#0b0b0f', '#f3efe7', '#8b1e3f', '#c7a76c'], fontMood: 'odważny' as FontMood },
  { id: 'street-neon', title: 'Street Neon', description: 'Neon, miasto, energia.', colors: ['#111827', '#00f5d4', '#ff2e63', '#faff00'], fontMood: 'odważny' as FontMood },
  { id: 'sport-stadium', title: 'Sport Stadium', description: 'Dynamiczna identyfikacja sportowa.', colors: ['#052e16', '#ffffff', '#22c55e', '#facc15'], fontMood: 'odważny' as FontMood },
  { id: 'pastel-beauty', title: 'Pastel Beauty', description: 'Pastelowo, lekko, kobieco.', colors: ['#4a2c2a', '#fff1f2', '#f9a8d4', '#c4b5fd'], fontMood: 'elegancki' as FontMood },
  { id: 'eco-organic', title: 'Eco Organic', description: 'Naturalne zielenie i ciepłe beże.', colors: ['#1f3d2b', '#f4efe6', '#a3b18a', '#d4a373'], fontMood: 'klasyczny' as FontMood },
  { id: 'tech-blue', title: 'Tech Blue', description: 'Chłodny, technologiczny styl.', colors: ['#0f172a', '#eff6ff', '#2563eb', '#38bdf8'], fontMood: 'nowoczesny' as FontMood },
  { id: 'food-warm', title: 'Food Warm', description: 'Ciepły gastro klimat.', colors: ['#3b1f14', '#fff7ed', '#f97316', '#facc15'], fontMood: 'klasyczny' as FontMood },
  { id: 'kids-playful', title: 'Kids Playful', description: 'Kolorowo i przyjaźnie.', colors: ['#1e3a8a', '#fefce8', '#fb7185', '#60a5fa'], fontMood: 'nowoczesny' as FontMood },
  { id: 'editorial-magazine', title: 'Editorial Magazine', description: 'Magazynowy layout i mocne nagłówki.', colors: ['#111111', '#fafafa', '#dc2626', '#a3a3a3'], fontMood: 'magazynowy' as FontMood },
  { id: 'creative-gradient', title: 'Creative Gradient', description: 'Gradienty dla twórców i marek online.', colors: ['#111827', '#f0f9ff', '#a855f7', '#ec4899'], fontMood: 'nowoczesny' as FontMood },
  { id: 'mono-luxury', title: 'Mono Luxury', description: 'Minimalistyczna czerń, biel i szarości.', colors: ['#050505', '#ffffff', '#d4d4d8', '#737373'], fontMood: 'elegancki' as FontMood },
];

visualThemes.push(
  { id: 'construction-premium', title: 'Construction Premium', description: 'Techniczny, solidny styl dla ekip i wykonawców.', colors: ['#18181b', '#f8fafc', '#f59e0b', '#52525b'], fontMood: 'nowoczesny' as FontMood },
  { id: 'automations-ai', title: 'Automation AI', description: 'Czysty styl tech dla automatyzacji, AI i procesów.', colors: ['#08111f', '#f8fbff', '#38bdf8', '#8b5cf6'], fontMood: 'nowoczesny' as FontMood },
  { id: 'finance-navy-gold', title: 'Finance Navy Gold', description: 'Wiarygodny, spokojny styl finansowy premium.', colors: ['#0b1324', '#f8fafc', '#d4af37', '#64748b'], fontMood: 'elegancki' as FontMood },
  { id: 'legal-burgundy', title: 'Legal Burgundy', description: 'Klasyczny, poważny styl kancelarii i doradztwa.', colors: ['#2a0f18', '#fff7ed', '#9f1239', '#c8b68a'], fontMood: 'klasyczny' as FontMood },
  { id: 'salon-champagne', title: 'Salon Champagne', description: 'Miękki, elegancki styl beauty i premium usług.', colors: ['#3f2a2d', '#fff7f2', '#e7c8a0', '#b76e79'], fontMood: 'elegancki' as FontMood },
  { id: 'fitness-energy', title: 'Fitness Energy', description: 'Mocny, sportowy kontrast dla treningu i dietetyki.', colors: ['#111827', '#f9fafb', '#ef4444', '#f97316'], fontMood: 'odważny' as FontMood },
  { id: 'coffee-craft', title: 'Coffee Craft', description: 'Rzemieślniczy klimat kawiarni, gastro i produktów lokalnych.', colors: ['#2b170f', '#fff7ed', '#b45309', '#facc15'], fontMood: 'klasyczny' as FontMood },
  { id: 'medical-trust', title: 'Medical Trust', description: 'Czysty, bezpieczny styl medyczny i zdrowotny.', colors: ['#0f766e', '#f8fafc', '#99f6e4', '#164e63'], fontMood: 'nowoczesny' as FontMood },
  { id: 'creative-studio', title: 'Creative Studio', description: 'Artystyczny, świeży styl dla twórców i studiów.', colors: ['#1f1235', '#fff7ff', '#f472b6', '#22d3ee'], fontMood: 'odważny' as FontMood },
  { id: 'local-clean', title: 'Local Clean', description: 'Prosty i schludny styl dla lokalnych usług.', colors: ['#1f2937', '#ffffff', '#10b981', '#e5e7eb'], fontMood: 'klasyczny' as FontMood },
);

const styleMeta: Record<string, {
  tags: string[];
  bestFor: string[];
  personality: string;
  fontPair: string;
  layoutHint: string;
  avoid: string;
  premium: number;
  energy: number;
}> = {
  'premium-black-gold': {
    tags: ['premium', 'kontrast', 'luksus'],
    bestFor: ['usługi premium', 'doradztwo', 'marka osobista'],
    personality: 'elegancka, pewna siebie, ekskluzywna',
    fontPair: 'serif display + sans',
    layoutHint: 'dużo czerni, dużo światła, mało elementów, mocny detal złoty',
    avoid: 'zbyt wielu ikon i tanich efektów złota',
    premium: 5,
    energy: 2,
  },
  'minimal-white': {
    tags: ['minimal', 'czytelność', 'czysto'],
    bestFor: ['oferty', 'edukacja', 'profesjonalne usługi'],
    personality: 'spokojna, uporządkowana, nowoczesna',
    fontPair: 'clean sans + medium sans',
    layoutHint: 'biała przestrzeń, cienkie linie, duża czytelność',
    avoid: 'przeładowania i zbyt dekoracyjnych fontów',
    premium: 3,
    energy: 1,
  },
  'luxury-real-estate': {
    tags: ['nieruchomości', 'premium', 'elegancja'],
    bestFor: ['agenci', 'deweloperzy', 'oferty premium'],
    personality: 'wiarygodna, elegancka, spokojna',
    fontPair: 'elegant serif + geometric sans',
    layoutHint: 'granat, złoto, eleganckie marginesy i zdjęcia premium',
    avoid: 'krzykliwych CTA i zbyt jaskrawych kolorów',
    premium: 5,
    energy: 2,
  },
  'bold-agency': {
    tags: ['marketing', 'odważnie', 'social'],
    bestFor: ['agencje', 'twórcy', 'reklamy'],
    personality: 'dynamiczna, kreatywna, sprzedażowa',
    fontPair: 'bold grotesk + compact sans',
    layoutHint: 'duże nagłówki, mocne kontrasty, elementy kampanijne',
    avoid: 'zbyt spokojnych i korporacyjnych układów',
    premium: 3,
    energy: 5,
  },
  'local-friendly': {
    tags: ['lokalnie', 'ciepło', 'zaufanie'],
    bestFor: ['lokalne usługi', 'małe firmy', 'rzemieślnicy'],
    personality: 'przyjazna, uczciwa, dostępna',
    fontPair: 'rounded sans + readable sans',
    layoutHint: 'ciepłe tła, proste ikony, komunikat bez zadęcia',
    avoid: 'zbyt luksusowej lub zimnej estetyki',
    premium: 2,
    energy: 2,
  },
  'clean-medical-beauty': {
    tags: ['beauty', 'czysto', 'spokój'],
    bestFor: ['kosmetologia', 'medycyna estetyczna', 'wellness'],
    personality: 'delikatna, czysta, profesjonalna',
    fontPair: 'light sans + elegant serif',
    layoutHint: 'jasne tła, miękkie akcenty, subtelne linie',
    avoid: 'agresywnych gradientów i chaosu',
    premium: 4,
    energy: 1,
  },
  'tattoo-dark-ink': {
    tags: ['tattoo', 'dark', 'charakter'],
    bestFor: ['studio tatuażu', 'barber', 'marka alternatywna'],
    personality: 'mocna, autorska, kontrastowa',
    fontPair: 'condensed display + clean sans',
    layoutHint: 'ciemne tło, wyrazisty znak, dużo kontrastu',
    avoid: 'pastelowej nijakości i przypadkowych ozdobników',
    premium: 4,
    energy: 4,
  },
  'tech-blue': {
    tags: ['tech', 'AI', 'B2B'],
    bestFor: ['SaaS', 'AI', 'automatyzacje'],
    personality: 'nowoczesna, logiczna, technologiczna',
    fontPair: 'geometric sans + mono accent',
    layoutHint: 'siatki, dashboardowe elementy, niebieskie akcenty',
    avoid: 'zbyt futurystycznego chaosu i neonowej przesady',
    premium: 3,
    energy: 3,
  },
  'automations-ai': {
    tags: ['AI', 'automatyzacje', 'procesy'],
    bestFor: ['wdrożenia Make/Zapier', 'chatboty', 'szkolenia AI'],
    personality: 'inteligentna, sprawna, praktyczna',
    fontPair: 'modern sans + mono',
    layoutHint: 'ciemny/clean tech, flow linie, kafelki procesów',
    avoid: 'robotów z stocka i magicznych przypadkowych ikon',
    premium: 4,
    energy: 4,
  },
  'construction-premium': {
    tags: ['budowlanka', 'solidnie', 'technicznie'],
    bestFor: ['remonty', 'wykończenia', 'elektryka'],
    personality: 'solidna, dokładna, techniczna',
    fontPair: 'strong sans + technical sans',
    layoutHint: 'ciemne tło, żółte akcenty, siatka techniczna',
    avoid: 'taniego marketowego stylu i bałaganu',
    premium: 4,
    energy: 3,
  },
  'finance-navy-gold': {
    tags: ['finanse', 'zaufanie', 'premium'],
    bestFor: ['edukacja finansowa', 'trading', 'doradztwo'],
    personality: 'wiarygodna, spokojna, ekspercka',
    fontPair: 'serif headline + professional sans',
    layoutHint: 'granat, złoto, czytelne wykresy i dużo porządku',
    avoid: 'krzykliwych obietnic i kasynowej estetyki',
    premium: 5,
    energy: 2,
  },
  'salon-champagne': {
    tags: ['beauty', 'premium', 'miękko'],
    bestFor: ['salony beauty', 'fryzjerstwo', 'kosmetologia'],
    personality: 'elegancka, kobieca, ciepła',
    fontPair: 'elegant serif + soft sans',
    layoutHint: 'beże, róż, miękkie światło, eleganckie marginesy',
    avoid: 'zbyt ostrego kontrastu i technicznego stylu',
    premium: 4,
    energy: 2,
  },
  'medical-trust': {
    tags: ['zdrowie', 'zaufanie', 'czysto'],
    bestFor: ['kliniki', 'rehabilitacja', 'terapia'],
    personality: 'bezpieczna, spokojna, profesjonalna',
    fontPair: 'humanist sans + clean sans',
    layoutHint: 'jasne tła, zieleń/turkus, klarowne sekcje',
    avoid: 'zbyt sprzedażowego języka i jaskrawych kontrastów',
    premium: 3,
    energy: 1,
  },
};

const getStyleMeta = (themeId: string) =>
  styleMeta[themeId] || {
    tags: ['spójnie', 'czytelnie', 'markowo'],
    bestFor: ['materiały firmowe', 'social media', 'brandbook'],
    personality: 'spójna, czytelna, profesjonalna',
    fontPair: 'display + sans',
    layoutHint: 'czytelna hierarchia, powtarzalne akcenty i mocny kontrast',
    avoid: 'przypadkowych efektów i niespójnych kolorów',
    premium: 3,
    energy: 3,
  };

const materials: MaterialTemplate[] = [
  {
    id: 'logo-concept',
    title: 'Logo / znak marki',
    category: 'Identyfikacja',
    description: 'Koncepcja logo lub prostego znaku, który potem trafia do brandbooka marki.',
    format: '1:1',
    style: 'illustration',
    promptGoal: 'Create ONE final professional logo only, centered on a clean plain background. The output must be a single finished logo mark / wordmark, not a brandbook page, not a presentation board, not a mockup, not multiple variants.',
    sections: [
      'one final logo version only',
      'main symbol or wordmark integrated into one coherent logo',
      'clean plain background',
      'generous clear space around the logo',
    ],
  },
  {
    id: 'business-card',
    title: 'Wizytówka',
    category: 'Druk',
    description: 'Dwustronna wizytówka: awers i rewers, układ przygotowany logicznie pod druk.',
    format: 'business-card',
    style: 'realistic',
    promptGoal: 'Create ONE premium double-sided business card design only. Show front and back as two clean separate cards in one composition, print-ready, professional, minimal, readable.',
    sections: [
      'front side: logo/name, short specialization, strong brand color usage',
      'back side: phone, email, website/Instagram only if provided',
      'print preparation: safe margin, bleed area suggestion, no text near edges',
      'brand colors and typography hierarchy',
      'show both sides clearly as separate cards, not one mixed layout',
    ],
  },
  {
    id: 'brandbook',
    title: 'Mini brandbook',
    category: 'Marka',
    description: 'Plansza z kolorami, fontami, stylem i zasadami komunikacji.',
    format: '4:5',
    style: 'illustration',
    promptGoal: 'Create ONE clean mini brandbook page only. It must be a structured visual identity guide, not a random poster, not a logo generator output, not a multi-page document.',
    sections: ['logo concept', 'color palette', 'typography suggestions', 'photo style', 'tone of voice', 'do and do not section'],
  },
  {
    id: 'offer-flyer',
    title: 'Ulotka / oferta',
    category: 'Druk',
    description: 'Jednostronicowa oferta z jasnym CTA.',
    format: 'a4-poster',
    style: 'realistic',
    promptGoal: 'Create ONE professional one-page flyer / offer sheet only. It must clearly present one offer with short benefits and one CTA, ready for print and digital sharing.',
    sections: ['headline', 'main offer', '3 benefits', 'contact box', 'call to action'],
  },
  {
    id: 'instagram-post',
    title: 'Post Instagram',
    category: 'Social media',
    description: 'Post promujący ofertę lub wyróżnik firmy.',
    format: '4:5',
    style: 'realistic',
    promptGoal: 'Create ONE high-converting Instagram 4:5 post only. It must focus on one hook, one offer or message, one clear CTA, mobile-first and readable.',
    sections: ['strong hook', 'one clear offer', 'benefit-driven copy', 'brand visual style', 'CTA'],
  },
  {
    id: 'story-reels-cover',
    title: 'Story / okładka Reels',
    category: 'Social media',
    description: 'Pionowy format do relacji, rolek, promocji i szybkiego CTA.',
    format: 'story',
    style: 'realistic',
    promptGoal: 'Create ONE vertical Story/Reels cover only. It must be mobile-first, high impact, with one big hook and very short readable copy.',
    sections: ['big hook', 'single visual focus', 'short benefit', 'CTA area', 'safe top and bottom margins for mobile UI'],
  },
  {
    id: 'linkedin-post',
    title: 'Post LinkedIn',
    category: 'Social media',
    description: 'Profesjonalny post ekspercki lub oferta B2B.',
    format: 'linkedin-post',
    style: 'realistic',
    promptGoal: 'Create ONE professional LinkedIn post graphic only. It must look B2B, expert, clean, readable, with one main insight or offer.',
    sections: ['expert headline', 'one clear insight or offer', '3 short supporting points', 'brand footer', 'CTA'],
  },
  {
    id: 'ad-banner',
    title: 'Baner reklamowy',
    category: 'Reklama',
    description: 'Baner do kampanii lub strony.',
    format: 'banner-wide',
    style: 'realistic',
    promptGoal: 'Create ONE premium advertising banner only. It must have a clear hero area, short headline, one benefit and one CTA.',
    sections: ['main headline', 'supporting benefit', 'visual hero area', 'CTA button style'],
  },
  {
    id: 'price-list',
    title: 'Cennik / karta usług',
    category: 'Druk',
    description: 'Czytelna karta usług, pakietów albo zakresu prac.',
    format: 'a4-poster',
    style: 'realistic',
    promptGoal: 'Create ONE clean premium service price list / offer card only. It must be structured, readable and not overcrowded.',
    sections: ['service categories', '3-5 service rows or packages', 'short notes', 'contact area', 'CTA'],
  },
  {
    id: 'voucher',
    title: 'Voucher / bon',
    category: 'Druk',
    description: 'Elegancki voucher prezentowy lub promocyjny.',
    format: 'business-card',
    style: 'realistic',
    promptGoal: 'Create ONE premium gift voucher design only. Show front and back as two separate sides only if the selected format is business-card; keep it elegant and print-ready.',
    sections: ['front side: voucher title and brand', 'back side: details, code/date placeholder, contact', 'safe print margins', 'premium decorative accents'],
  },
  {
    id: 'company-starter-pack',
    title: 'Pakiet startowy firmy',
    category: 'Strategia',
    description: 'Lista materiałów, które firma powinna mieć na start.',
    format: '4:5',
    style: 'illustration',
    promptGoal: 'Create ONE practical starter materials checklist infographic only. It must be clear, useful and not pretend to be a full brandbook.',
    sections: ['must-have print materials', 'must-have social materials', 'sales assets', 'brand consistency tips'],
  },
  {
    id: 'niche-map',
    title: 'Mapa niszy',
    category: 'Strategia',
    description: 'Plansza z propozycjami nisz i kierunkiem testu.',
    format: '4:5',
    style: 'illustration',
    promptGoal: 'Create ONE premium niche discovery board only. It must show clear niche options and next steps, not a random marketing poster.',
    sections: ['3-5 niche ideas', 'target customer', 'main problem', 'offer idea', 'first materials to create'],
  },
  {
    id: 'concept-visualization',
    title: 'Wizualizacja konceptu marki',
    category: 'Marka',
    description: 'Pierwszy kierunek wizualny marki.',
    format: '4:5',
    style: 'illustration',
    promptGoal: 'Create ONE polished first brand concept visualization only. It must show the proposed visual direction in a controlled moodboard-style layout, not generate final separate assets.',
    sections: ['brand moodboard', 'sample logo direction', 'color palette', 'typography direction', 'example post', 'business card preview'],
  },
];

const materialVariants: Record<string, MaterialVariant[]> = {
  'business-card': [
    {
      id: 'brand-first',
      title: 'Marka na pierwszym planie',
      description: 'Mocny awers z logo, spokojny rewers z kontaktem.',
      promptInstruction: 'Use a brand-first layout: a bold, minimal front with the exact logo/name and a clean information-led back. Keep both sides visually connected.',
    },
    {
      id: 'typographic-premium',
      title: 'Typograficzna premium',
      description: 'Elegancka hierarchia liter, dużo światła i mało ozdobników.',
      promptInstruction: 'Use a premium typography-led layout with generous whitespace, refined alignment, subtle brand accents and no decorative clutter.',
    },
    {
      id: 'bold-split',
      title: 'Nowoczesny podział',
      description: 'Wyrazisty podział koloru i czytelne bloki informacji.',
      promptInstruction: 'Use a modern split-layout with one strong color field, one neutral field and a disciplined grid. Keep the contact side exceptionally readable.',
    },
  ],
  'offer-flyer': [
    {
      id: 'single-offer',
      title: 'Jedna główna oferta',
      description: 'Najmocniej sprzedaje jedną usługę i jedno CTA.',
      promptInstruction: 'Focus the whole page on one primary offer: one promise, three concrete benefits, one proof/detail block and one clear CTA.',
    },
    {
      id: 'services-overview',
      title: 'Przegląd usług',
      description: 'Czytelnie pokazuje 3–5 usług bez ściany tekstu.',
      promptInstruction: 'Build a structured services overview with 3 to 5 short service cards, one concise value proposition and one contact CTA. Do not invent prices.',
    },
    {
      id: 'premium-b2b',
      title: 'Oferta B2B premium',
      description: 'Spokojna, ekspercka kompozycja dla droższej usługi.',
      promptInstruction: 'Use an executive B2B offer-sheet direction: restrained composition, credible hierarchy, concise proof points and a premium consultation CTA.',
    },
  ],
  'instagram-post': [
    {
      id: 'offer',
      title: 'Post sprzedażowy',
      description: 'Hook, korzyść i jedno jasne wezwanie do działania.',
      promptInstruction: 'Create a conversion-led offer post with one short hook, one concrete benefit, one visual focal point and one CTA.',
    },
    {
      id: 'expert',
      title: 'Post ekspercki',
      description: 'Wiedza, wskazówka lub mini checklista budująca zaufanie.',
      promptInstruction: 'Create an expert educational post with one useful insight and up to three very short supporting points. The brand should feel credible, not aggressively sales-led.',
    },
    {
      id: 'announcement',
      title: 'Ogłoszenie / premiera',
      description: 'Czytelna informacja o nowości, starcie lub ważnym terminie.',
      promptInstruction: 'Create a clear announcement post with one event/new-offer message, a strong date or key fact only when supplied, and one next-step CTA.',
    },
  ],
  'story-reels-cover': [
    {
      id: 'hook-cover',
      title: 'Mocny hook',
      description: 'Duży tytuł i jeden wyrazisty motyw.',
      promptInstruction: 'Use a hook-first cover with a very large short headline and one strong visual subject, leaving safe space for the mobile interface.',
    },
    {
      id: 'offer-story',
      title: 'Oferta w Story',
      description: 'Krótka korzyść i CTA w dolnej strefie bezpiecznej.',
      promptInstruction: 'Use a mobile offer layout with one benefit, one concise supporting line and one CTA placed inside the safe lower-middle area.',
    },
  ],
  'linkedin-post': [
    {
      id: 'insight',
      title: 'Insight ekspercki',
      description: 'Jedna mocna teza i maksymalnie trzy argumenty.',
      promptInstruction: 'Use an editorial B2B insight layout with one strong thesis and up to three concise supporting points.',
    },
    {
      id: 'case-study',
      title: 'Case study',
      description: 'Problem, rozwiązanie i rezultat bez wymyślonych liczb.',
      promptInstruction: 'Use a compact case-study structure: challenge, approach, outcome. Never invent metrics, client names or claims that are not in the brief.',
    },
  ],
  'ad-banner': [
    {
      id: 'lead-generation',
      title: 'Pozyskiwanie kontaktów',
      description: 'Obietnica, korzyść i jedno CTA.',
      promptInstruction: 'Use a lead-generation layout with one clear promise, one supporting benefit and one high-contrast CTA area. Do not invent scarcity or guarantees.',
    },
    {
      id: 'brand-awareness',
      title: 'Budowanie marki',
      description: 'Mocny obraz marki i krótki komunikat.',
      promptInstruction: 'Use a brand-awareness layout with a distinctive branded hero visual, a very short memorable message and restrained CTA treatment.',
    },
    {
      id: 'local-service',
      title: 'Usługa lokalna',
      description: 'Czytelna specjalizacja, obszar i kontakt – tylko gdy podane.',
      promptInstruction: 'Use a local-service campaign layout emphasizing the exact specialization, supplied location and supplied contact data. Never invent a location or phone number.',
    },
  ],
  'price-list': [
    {
      id: 'service-list',
      title: 'Lista usług',
      description: 'Prosta tabela lub lista kategorii.',
      promptInstruction: 'Use a clean service-list structure with clear categories and aligned rows. If exact prices are absent, omit prices instead of fabricating them.',
    },
    {
      id: 'packages',
      title: 'Pakiety',
      description: 'Porównanie maksymalnie trzech pakietów.',
      promptInstruction: 'Use a maximum of three clearly differentiated packages. Only use package names, features and prices supplied in the brief.',
    },
  ],
  voucher: [
    {
      id: 'gift-premium',
      title: 'Prezentowy premium',
      description: 'Elegancki bon z miejscem na dane odbiorcy.',
      promptInstruction: 'Use an elegant gift-voucher direction with restrained decoration and clearly separated fields for recipient, giver and code/date placeholders.',
    },
    {
      id: 'service-voucher',
      title: 'Voucher na usługę',
      description: 'Eksponuje konkretną usługę bez wymyślania wartości.',
      promptInstruction: 'Feature the exact service from the brief as the voucher subject. Do not invent monetary value, expiry date, discount or conditions.',
    },
  ],
  'concept-visualization': [
    {
      id: 'clean-direction',
      title: 'Czysty kierunek marki',
      description: 'Paleta, typografia i jedna przykładowa kompozycja.',
      promptInstruction: 'Build a controlled art-direction board with palette, typography mood and one representative composition. Keep it curated and spacious.',
    },
    {
      id: 'bold-direction',
      title: 'Odważny kierunek marki',
      description: 'Mocniejszy charakter, kontrast i rozpoznawalny motyw.',
      promptInstruction: 'Build a bold but disciplined art-direction board with a recognizable graphic motif, strong contrast and consistent typography.',
    },
  ],
};

const getMaterialVariants = (materialId: string) => materialVariants[materialId] || [];

const getMaterialVariant = (materialId: string, variantId?: string) => {
  const variants = getMaterialVariants(materialId);
  return variants.find((variant) => variant.id === variantId) || variants[0] || null;
};

const mirrorFields = [
  ['companyName', 'Nazwa firmy'],
  ['industry', 'Branża / specjalizacja'],
  ['stage', 'Etap'],
  ['positioning', 'Pozycjonowanie marki'],
  ['targetAudience', 'Klient docelowy'],
  ['customerProblem', 'Problem / potrzeba klienta'],
  ['offer', 'Główna oferta / produkt'],
  ['specialization', 'Specjalizacja'],
  ['differentiator', 'Wyróżnik'],
  ['mainMessage', 'Główny komunikat marki'],
  ['tone', 'Ton komunikacji'],
  ['cta', 'CTA'],
  ['visualDirection', 'Kierunek wizualny'],
  ['layoutRules', 'Zasady layoutu'],
  ['textRules', 'Zasady tekstu na grafice'],
  ['printNotes', 'Notatki do druku'],
  ['contactPerson', 'Imię i nazwisko na wizytówce'],
  ['jobTitle', 'Stanowisko / rola'],
  ['phone', 'Telefon'],
  ['email', 'E-mail'],
  ['website', 'WWW'],
  ['instagram', 'Instagram'],
  ['avoidList', 'Czego unikać'],
] as const;

const briefSections = [
  {
    title: '1. Fundament marki',
    description: 'Najważniejsze dane, które AI ma traktować jako źródło prawdy.',
    fields: [
      ['companyName', 'Nazwa firmy'],
      ['logoStatus', 'Status logo'],
      ['logoStyle', 'Styl logo'],
      ['brandMood', 'Klimat marki'],
      ['logoNotes', 'Notatki do logo'],
      ['industry', 'Branża / specjalizacja'],
      ['stage', 'Etap'],
      ['positioning', 'Pozycjonowanie marki'],
    ],
  },
  {
    title: '2. Oferta i odbiorca',
    description: 'Dzięki temu materiały nie są ogólne, tylko mówią do właściwego klienta.',
    fields: [
      ['targetAudience', 'Klient docelowy'],
      ['customerProblem', 'Problem / potrzeba klienta'],
      ['offer', 'Główna oferta / produkt'],
      ['specialization', 'Specjalizacja'],
      ['differentiator', 'Wyróżnik'],
    ],
  },
  {
    title: '3. Komunikacja',
    description: 'Teksty, CTA i zakazy, które mają trzymać spójność marki.',
    fields: [
      ['tone', 'Ton komunikacji'],
      ['mainMessage', 'Główny komunikat marki'],
      ['cta', 'CTA'],
      ['avoidList', 'Czego unikać'],
    ],
  },
  {
    title: '4. Styl wizualny',
    description: 'Instrukcje dla modeli graficznych: klimat, układ i kolory.',
    fields: [
      ['visualDirection', 'Kierunek wizualny'],
      ['layoutRules', 'Zasady layoutu'],
      ['textRules', 'Zasady tekstu na grafice'],
      ['printNotes', 'Notatki do druku'],
    ],
  },
  {
    title: '5. Kontakt',
    description: 'Puste pola będą pomijane w materiałach.',
    fields: [
      ['contactPerson', 'Imię i nazwisko na wizytówce'],
      ['jobTitle', 'Stanowisko / rola'],
      ['phone', 'Telefon'],
      ['email', 'E-mail'],
      ['website', 'WWW'],
      ['instagram', 'Instagram'],
    ],
  },
] as const;

const getTheme = (themeId: string) => visualThemes.find((theme) => theme.id === themeId) || visualThemes[1];

const formatLabels: Record<MaterialTemplate['format'], string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  'banner-wide': 'Baner wide',
  'business-card': 'Wizytówka 3:2',
  '9:16': '9:16',
  '2:3': '2:3',
  '4:5': '4:5',
  'a4-poster': 'A4 / oferta',
  story: 'Story/Reels',
  'linkedin-post': 'LinkedIn',
};

function colorTokens(colors: string) {
  return colors.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
}

const isRealCompanyName = (value?: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.length < 2) return false;
  return ![
    'nie mam',
    'użyj nazwy roboczej',
    'uzyj nazwy roboczej',
    'zaproponuj nazwę',
    'zaproponuj nazwe',
    'pasującą do briefu',
    'pasujaca do briefu',
    'placeholder',
    'nazwa firmy',
    'nazwa marki',
    'brand name',
  ].some((phrase) => normalized.includes(phrase));
};

const selectedMaterialsNeedCompanyName = (materialIds: string[]) =>
  materialIds.some((id) => materialIdsRequiringCompanyName.has(id));

function previewColors(themeId: string, customColors: string) {
  const theme = getTheme(themeId);
  const hexColors = colorTokens(customColors).filter((color) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color));
  if (hexColors.length >= 2) return [hexColors[0], hexColors[1], hexColors[2] || theme.colors[2], hexColors[3] || theme.colors[3]];
  return theme.colors;
}

function enrichBrandBrief(profile: Record<string, string>, themeId: string, customColors: string) {
  const theme = getTheme(themeId);
  const next = { ...profile };
  const industry = next.industry || 'branża do doprecyzowania';
  const offer = next.offer || next.specialization || 'główna oferta';
  const audience = next.targetAudience || 'klient docelowy do doprecyzowania';
  const differentiator = next.differentiator || 'indywidualne podejście i profesjonalna jakość';
  const tone = next.tone || 'profesjonalny, prosty i konkretny';
  const colors = colorTokens(customColors);

  if (!next.positioning) {
    next.positioning = `${industry}: marka dla ${audience}, budowana wokół oferty „${offer}” i wyróżnika: ${differentiator}.`;
  }

  if (!next.customerProblem) {
    next.customerProblem = `Klient potrzebuje jasnej, wiarygodnej oferty w obszarze: ${offer}. Materiały mają szybko pokazać, dlaczego warto wybrać tę markę.`;
  }

  if (!next.mainMessage) {
    next.mainMessage = `${offer} dla ${audience} — czytelnie, profesjonalnie i bez chaosu.`;
  }

  if (!next.visualDirection) {
    next.visualDirection = `${theme.title}: ${theme.description} Paleta: ${colors.length ? colors.join(', ') : theme.colors.join(', ')}.`;
  }

  if (!next.layoutRules) {
    next.layoutRules = 'Duże marginesy, mocny nagłówek, maksymalnie 3 krótkie punkty, jedno CTA, dużo światła i wyraźna hierarchia.';
  }

  if (!next.textRules) {
    next.textRules = 'Teksty na grafice muszą być krótkie, duże i czytelne. Unikać długich zdań, drobnego tekstu i przeładowania informacjami.';
  }

  if (!next.printNotes) {
    next.printNotes = 'Materiały drukowane: zachować bezpieczne marginesy, nie umieszczać tekstu przy krawędziach, używać wysokiego kontrastu.';
  }

  if (!next.avoidList) {
    next.avoidList = 'Unikać chaosu, taniego stockowego wyglądu, zbyt małego tekstu, przypadkowych ikon i niespójnych kolorów.';
  }

  return next;
}

function validateBrief(profile: Record<string, string>, themeId: string, customColors: string) {
  const warnings: string[] = [];
  const nextProfile = enrichBrandBrief(profile, themeId || 'minimal-white', customColors);
  if (!nextProfile.cta) {
    const industry = (nextProfile.industry || '').toLowerCase();
    nextProfile.cta = industry.includes('tatua') ? 'Zarezerwuj termin' : industry.includes('gastro') ? 'Sprawdź menu' : 'Napisz do nas';
    warnings.push('Brak CTA — wstawiono domyślne wezwanie do działania.');
  }
  if (!nextProfile.targetAudience) warnings.push('Brak klienta docelowego — materiały mogą być bardziej ogólne.');
  if (!nextProfile.industry) warnings.push('Brak branży — prompt będzie mniej precyzyjny.');
  if (!themeId) warnings.push('Brak stylu — wybrano domyślny styl Minimal White.');
  if (!customColors && !themeId) warnings.push('Brak kolorów — użyto domyślnej palety.');
  return { profile: nextProfile, warnings };
}

function buildLocalBriefQuality(profile: Record<string, string>, analysis?: BriefAnalysis | null): BriefQuality {
  const required = [
    ['companyName', 'Brakuje nazwy firmy albo decyzji, że AI ma użyć nazwy roboczej.'],
    ['logoStatus', 'Brakuje informacji, czy marka ma już logo.'],
    ['logoStyle', 'Brakuje kierunku logo / znaku marki.'],
    ['industry', 'Brakuje branży.'],
    ['targetAudience', 'Brakuje klienta docelowego.'],
    ['offer', 'Brakuje głównej oferty.'],
    ['differentiator', 'Brakuje wyróżnika marki.'],
    ['tone', 'Brakuje tonu komunikacji.'],
    ['cta', 'Brakuje CTA.'],
  ] as const;
  const gaps = required.filter(([key]) => !String(profile[key] || '').trim()).map(([, label]) => label);
  const strengths = required
    .filter(([key]) => String(profile[key] || '').trim())
    .map(([key]) => {
      const labels: Record<string, string> = {
        companyName: 'Nazwa firmy jest określona.',
        logoStatus: 'Status logo jest określony.',
        logoStyle: 'Kierunek logo jest określony.',
        industry: 'Branża jest określona.',
        targetAudience: 'Klient docelowy jest określony.',
        offer: 'Oferta jest określona.',
        differentiator: 'Wyróżnik jest określony.',
        tone: 'Ton komunikacji jest określony.',
        cta: 'CTA jest określone.',
      };
      return labels[key];
    });
  const conflicts = analysis?.briefQuality?.conflicts || [];
  const completed = required.length - gaps.length;
  const score = Math.max(0, Math.min(100, Math.round((completed / required.length) * 85 + (analysis?.confidence || 0) * 15 - conflicts.length * 15)));

  return {
    score,
    level: score >= 75 ? 'strong' : score >= 45 ? 'medium' : 'weak',
    strengths: strengths.slice(0, 5),
    gaps,
    suggestions: [
      !profile.targetAudience ? 'Doprecyzuj, do kogo dokładnie mówimy w materiałach.' : '',
      !profile.offer ? 'Nazwij jedną główną usługę lub produkt, który ma być widoczny.' : '',
      !profile.differentiator ? 'Dodaj powód, dlaczego klient ma wybrać właśnie tę markę.' : '',
      !profile.cta ? 'Dodaj jedno proste wezwanie do działania.' : '',
    ].filter(Boolean),
    conflicts,
  };
}

function materialSpecificRules(material: MaterialTemplate, profile: Record<string, string>) {
  const hasCompanyName = Boolean(profile.companyName && !profile.companyName.toLowerCase().includes('nie mam'));
  const contactFields = [
    profile.phone ? 'phone' : '',
    profile.email ? 'email' : '',
    profile.website ? 'website' : '',
    profile.instagram ? 'Instagram' : '',
  ].filter(Boolean).join(', ') || 'none';

  const common = [
    '- generate exactly ONE finished design for the selected material',
    '- do not create unrelated assets, alternate concepts, extra pages, extra slides, thumbnails, previews, or mockups unless explicitly requested for this material',
    '- do not invent company data, prices, addresses, phone numbers, emails, websites, social handles, dates, certifications, awards, or QR codes',
    '- visible copy must be short, clean and useful; if text is missing, use clean placeholders or omit that area',
  ];

  const rules: Record<string, string[]> = {
    'logo-concept': [
      '- LOGO RULES: generate exactly ONE final logo version only',
      profile.logoPromptStyleInstruction ? `- REQUIRED LOGO CONSTRUCTION: ${profile.logoPromptStyleInstruction}` : '',
      profile.logoTextMode === 'symbol-only' ? '- output a standalone symbol mark only; do not include company name text' : '',
      profile.logoTextMode === 'monogram' ? '- focus on a monogram / initials mark; do not invent random letters outside the company name initials' : '',
      '- place the logo centered on a simple plain background',
      '- do not create a logo sheet, brandbook board, presentation grid, comparison view, mockup, business card, or multiple variants',
      '- do not add labels like main logo, symbol, monochrome version, clear space, color palette, or brand guidelines',
      hasCompanyName
        ? '- include only the exact company name as the logo text; do not add slogans, contact data, bullets, CTA, descriptions, or extra paragraphs'
        : '- create a tasteful placeholder wordmark but keep it as one logo only',
      '- keep the mark simple, scalable, vector-like, high contrast, memorable, and readable at small size',
      '- design for real identity use: the silhouette must remain recognizable at favicon size and the logo must still work in one solid color',
      '- use deliberate custom geometry or lettering; avoid generic stock icons, random AI circuit brains, globes, swooshes, shields and meaningless hexagons unless the brief explicitly requires one',
      '- flat orthographic artwork only; no 3D bevel, metallic mockup, wall signage, paper texture, light glow, lens flare, shadows behind a presentation board, or photorealistic scene',
      '- preserve exact spelling and normal letter order; do not mirror, duplicate, merge into unreadable glyphs, or replace letters with ambiguous symbols',
      profile.logoPromptStyleAvoid ? `- avoid for this logo style: ${profile.logoPromptStyleAvoid}` : '',
      profile.logoPromptNotes ? `- user logo notes: ${profile.logoPromptNotes}` : '',
    ],
    'business-card': [
      '- BUSINESS CARD RULES: create one double-sided business card design only',
      '- use a flat orthographic presentation showing exactly two separate 3:2 rectangular card faces: FRONT and BACK; no perspective mockup, no hands, no desk scene, no stacked cards',
      '- front side: company name/logo, specialization, minimal brand visual',
      `- back side: include only provided contact fields: ${contactFields}`,
      '- do not add fake address, fake QR code, fake NIP, fake social icons, fake map, fake portrait, unrelated photo, or offer flyer content',
      '- keep all essential content at least 5% away from every edge; show a clean bleed-safe background extending to the edge',
      '- use one primary font family and at most one supporting font; keep name, role and contact hierarchy obvious',
      '- the front and back must use the same grid, palette, corner language and visual motif',
      '- keep text inside safe margins; avoid tiny text; premium production-ready design concept',
    ],
    brandbook: [
      '- BRANDBOOK RULES: create one mini brandbook page only',
      '- include compact sections: logo direction, colors, typography mood, graphic/photo style, tone of voice, do/dont',
      '- do not create multiple separate pages, do not create a finished logo sheet, do not create business card mockups as the main output',
      '- use simple labels and visual swatches; avoid long paragraphs',
    ],
    'offer-flyer': [
      '- FLYER / OFFER RULES: create one single-page offer only',
      '- layout: headline, short subheadline, 3 benefits, offer block, contact/CTA footer',
      '- do not create a business card, menu, price list, poster set, carousel, or multiple variants',
      '- include only contact data that was provided',
      '- use a clear reading path from headline to proof/benefits to CTA; one dominant message only',
      '- never insert English filler text, lorem ipsum, fake testimonials, fake partner logos, fake awards, fake prices or fabricated statistics',
      '- use one relevant hero visual or one controlled graphic system, never a random collage of unrelated stock imagery',
    ],
    'instagram-post': [
      '- INSTAGRAM POST RULES: create one 4:5 feed post only',
      '- mobile-first layout: big hook, one clear visual focus, max 3 short points, one CTA',
      '- do not create a carousel, story, banner, flyer, business card, or multiple post versions',
      '- no tiny legal text, no long paragraphs, no fake UI elements',
      '- keep the main hook readable at phone-thumbnail size and keep important content inside a central safe area',
      '- use the exact brand palette and repeat one recognizable brand motif that can be reused in future posts',
    ],
    'story-reels-cover': [
      '- STORY / REELS RULES: create one vertical cover only',
      '- keep important text away from top and bottom mobile UI zones',
      '- use one big hook, one visual focus, and one short CTA',
      '- do not create a feed post, carousel, flyer, or multiple story frames',
    ],
    'linkedin-post': [
      '- LINKEDIN RULES: create one professional B2B post graphic only',
      '- use one expert headline, one insight/offer, max 3 supporting points, subtle footer',
      '- do not create a resume, website hero, ad banner, flyer, or carousel',
      '- avoid playful decorations unless the brand mood explicitly asks for them',
    ],
    'ad-banner': [
      '- AD BANNER RULES: create one wide campaign banner only',
      '- layout: hero area, short headline, one supporting benefit, one CTA button style',
      '- do not create a flyer, social post, website mockup, landing page, or multiple ad sizes',
      '- keep CTA readable and do not add fake badges, prices, timers, or guarantees',
      '- reserve obvious negative space around the headline and CTA; do not place copy over a busy face or detailed background',
    ],
    'price-list': [
      '- PRICE LIST RULES: create one structured service/offer card only',
      '- use 3-5 rows/packages maximum; if prices are not provided, use neutral placeholders or omit exact prices',
      '- do not invent prices, discounts, taxes, dates, guarantees, or legal notes',
      '- do not create a flyer, voucher, menu, or brandbook',
      '- align names, descriptions and values to a consistent grid; visual decoration must never compete with the service information',
    ],
    voucher: [
      '- VOUCHER RULES: create one premium voucher design only',
      '- show a clear voucher title, brand name, placeholder code/date area only if needed, and provided contact only',
      '- do not invent voucher value, expiry date, discount amount, QR code, or terms',
      '- do not create a price list, flyer, loyalty card, or multiple voucher variants',
    ],
    'company-starter-pack': [
      '- STARTER PACK RULES: create one concise checklist infographic only',
      '- show practical material categories a company should prepare; keep it educational and simple',
      '- do not create the actual logo, business card, flyer, or brandbook as separate outputs',
      '- no fake contact data, no unrelated icons overload',
    ],
    'niche-map': [
      '- NICHE MAP RULES: create one niche discovery board only',
      '- show 3-5 niche ideas, target customer, problem, offer angle, and first test material',
      '- do not pretend the user already selected one final company if they are still exploring',
      '- do not create a logo, advertisement, flyer, or brandbook',
    ],
    'concept-visualization': [
      '- CONCEPT VISUALIZATION RULES: create one controlled moodboard-style brand direction only',
      '- show visual mood, colors, typography mood, sample composition, and brand feel',
      '- do not create final production-ready assets, multiple logos, full brandbook pages, or finished print files',
      '- keep it as a strategic preview of direction, not a random collage',
    ],
  };

  return [...common, ...(rules[material.id] || [])].join('\n');
}

function buildMaterialPrompt(
  profile: Record<string, string>,
  material: MaterialTemplate,
  themeId: string,
  customColors: string,
  variantId?: string,
) {
  const theme = getTheme(themeId);
  const colors = colorTokens(customColors);
  const validated = validateBrief(profile, themeId, customColors);
  const p = validated.profile;
  const variant = getMaterialVariant(material.id, variantId);

  return [
    material.promptGoal,
    '',
    `MATERIAL: ${material.title}`,
    `TARGET FORMAT SELECTED IN APP: ${formatLabels[material.format] || material.format}`,
    variant ? `SELECTED PRODUCTION DIRECTION: ${variant.title}` : '',
    variant ? `DIRECTION INSTRUCTION: ${variant.promptInstruction}` : '',
    '',
    'Use the approved brand brief below as the single source of truth.',
    'Do not use old project data, old industry context, previous prompts, or assumptions not present in the approved brief.',
    'If a field is marked as not specified or not provided, leave it out visually instead of inventing fake data.',
    '',
    'APPROVED BRAND BRIEF:',
    `Company name: ${p.companyName || 'use a tasteful placeholder brand name'}`,
    `Logo status: ${p.logoStatus || 'not specified'}`,
    `Logo direction / style: ${p.logoStyle || 'not specified'}`,
    `Selected logo construction: ${p.logoPromptStyleTitle || 'not specified'}`,
    `Logo text mode: ${p.logoTextMode || 'company-name'}`,
    `Logo construction instruction: ${p.logoPromptStyleInstruction || 'not specified'}`,
    `Brand mood: ${p.brandMood || 'not specified'}`,
    `Logo notes: ${p.logoNotes || 'not specified'}`,
    `Extra logo prompt notes: ${p.logoPromptNotes || 'not specified'}`,
    `Industry / specialization: ${p.industry || 'not specified'}`,
    `Business stage: ${p.stage || 'not specified'}`,
    `Brand positioning: ${p.positioning || 'not specified'}`,
    `Brand archetype: ${p.brandArchetype || 'not specified'}`,
    `Brand archetype guidance: ${p.brandArchetypePromptHint || 'not specified'}`,
    `Target audience: ${p.targetAudience || 'not specified'}`,
    `Customer problem / need: ${p.customerProblem || 'not specified'}`,
    `Offer / product: ${p.offer || p.specialization || 'not specified'}`,
    `Differentiator: ${p.differentiator || 'not specified'}`,
    `Main brand message: ${p.mainMessage || p.slogan || 'not specified'}`,
    `Slogan / claim: ${p.slogan || 'not specified'}`,
    `Tone of voice: ${p.tone || p.brandArchetypeTone || 'professional and clear'}`,
    `CTA: ${p.cta || 'Napisz do nas'}`,
    `Contact person: ${p.contactPerson || 'not provided'}`,
    `Job title / role: ${p.jobTitle || 'not provided'}`,
    `Contact: phone ${p.phone || 'not provided'}, email ${p.email || 'not provided'}, website ${p.website || 'not provided'}, Instagram ${p.instagram || 'not provided'}`,
    `Avoid: ${p.avoidList || 'avoid clutter and low quality design'}`,
    '',
    'VISUAL STYLE:',
    `Selected theme: ${theme.title}`,
    `Theme description: ${theme.description}`,
    `Font mood: ${theme.fontMood}`,
    `Visual direction: ${p.visualDirection || theme.description}`,
    `Layout rules: ${p.layoutRules || 'clean hierarchy, safe margins, readable composition'}`,
    `Text rules: ${p.textRules || 'short readable copy only'}`,
    `Print notes: ${p.printNotes || 'safe margins and high contrast for print materials'}`,
    colors.length > 0 ? `User custom colors, priority: ${colors.join(', ')}` : `Theme colors: ${theme.colors.join(', ')}`,
    colors.length > 0
      ? 'Use the user-provided colors as the main palette. You may add one neutral support color only if needed for readability.'
      : 'Propose a refined color palette based on the selected theme: primary color, secondary color, background color, accent color. Keep it consistent across the material.',
    '',
    'MATERIAL STRUCTURE:',
    ...material.sections.map((section) => `- ${section}`),
    '',
    'DESIGN RULES:',
    materialSpecificRules(material, p),
    material.category === 'Druk'
      ? '- PRINT RULES: clean margins, no important text close to edges, high contrast, professional print layout, CMYK-friendly color feeling'
      : '',
    '- use Polish language for visible copy',
    '- keep visible copy short: max 1 headline, max 3 short bullets, max 1 CTA',
    '- avoid long paragraphs and small text because AI image models often distort letters',
    '- if there is a lot of information, design clear placeholders and hierarchy instead of forcing all text into the image',
    '- keep all visible text readable',
    '- high contrast, clean spacing, premium composition',
    '- no watermark, no social media icons unless explicitly needed',
    '- do not include missing contact data',
  ].filter(Boolean).join('\n');
}

function extractLiteCompanyName(text: string) {
  const match = text.match(/(?:firma|marka|nazwa|studio|salon)\s+(?:nazywa się|to|:)?\s*["„]?([\p{L}\p{N}\s&.-]{3,40})/iu);
  return match?.[1]?.trim().replace(/[,.].*$/, '') || '';
}

function buildLiteCompanyPrompt({
  description,
  material,
  themeId,
  companyName,
  industry,
  customColors,
  logoStyle = 'symbol-wordmark',
  materialVariantId,
}: {
  description: string;
  material: MaterialTemplate;
  themeId: string;
  companyName: string;
  industry: string;
  customColors: string;
  logoStyle?: LiteLogoStyle;
  materialVariantId?: string;
}) {
  const theme = getTheme(themeId);
  const name = companyName || extractLiteCompanyName(description) || 'use a clean placeholder brand name';
  const brandLine = industry || description.split(/[.!?\n]/)[0]?.trim() || 'small business';
  const colors = customColors.trim() || theme.colors.join(', ');
  const materialVariant = getMaterialVariant(material.id, materialVariantId);
  const base = [
    `Brand / company: ${name}`,
    `Business: ${brandLine}`,
    `User brief: ${description.trim() || 'not specified'}`,
    `Visual style: ${theme.title} — ${theme.description}`,
    `Colors: ${colors}`,
    'Text accuracy: preserve the exact company name spelling. Do not add, remove, swap, mirror, stylize into unreadable glyphs, or misspell letters.',
    '',
  ];

  const liteLogoInstructions: Record<LiteLogoStyle, string[]> = {
    'symbol-wordmark': [
      `Create ONE clean professional logo for "${name}".`,
      `Industry: ${brandLine}.`,
      `Style: ${theme.title}, modern, readable, memorable, vector-like.`,
      'Logo type: simple distinctive symbol + exact company name wordmark.',
      'The symbol should support the name, but the company name must stay readable.',
      'Output: one final logo only, centered on a plain background.',
      'No mockup, no logo sheet, no multiple variants, no extra labels, no contact data, no slogan.',
    ],
    'typographic-wordmark': [
      `Create ONE typographic wordmark logo for the exact name "${name}".`,
      `Industry: ${brandLine}.`,
      `Style: ${theme.title}, modern, readable, memorable, vector-like.`,
      'Logo type: the company name itself is the logo. Build distinctive custom lettering by modifying terminals, cuts, ligatures, counters, rhythm and spacing while keeping every letter readable.',
      'Do NOT place a separate icon next to the name. No standalone symbol. No pictogram beside the text.',
      'You may subtly transform 1-2 letters into a brand detail, but the exact name must remain readable.',
      'The wordmark must work in one solid color and remain recognizable at small size. Use flat vector-like geometry only.',
      'Output: one final wordmark only, centered on a plain background.',
      'No mockup, no logo sheet, no multiple variants, no extra labels, no contact data, no slogan.',
    ],
    lettermark: [
      `Create ONE letter-based logo for the exact name "${name}".`,
      `Industry: ${brandLine}.`,
      `Style: ${theme.title}, modern, readable, memorable, vector-like.`,
      'Logo type: use the first letter or initials as a custom mark integrated with the full company name.',
      'The lettering should have modified letter shapes and strong spacing, not a generic font.',
      'Output: one final logo only, centered on a plain background.',
      'No mockup, no logo sheet, no multiple variants, no extra labels, no contact data, no slogan.',
    ],
  };

  const promptByMaterial: Record<string, string[]> = {
    'logo-concept': liteLogoInstructions[logoStyle],
    'business-card': [
      `Create ONE premium double-sided business card for "${name}".`,
      `Business: ${brandLine}.`,
      'Show exactly TWO flat 3:2 card faces in one clean orthographic composition: FRONT and BACK.',
      'Front: logo/name, short specialization, strong brand color.',
      'Back: contact hierarchy; when contact data is absent, leave clearly designed empty fields rather than inventing data.',
      'Keep all important content inside a generous safe margin. Use the same grid, palette and visual motif on both sides.',
      'No perspective, no hand, no desk, no stacked-card mockup, no fake QR code, no fake address, no clutter, no tiny text.',
    ],
    brandbook: [
      `Create ONE clean mini brandbook page for "${name}".`,
      `Business: ${brandLine}.`,
      'Include: logo direction, color palette, typography mood, graphic/photo style, tone of voice, do/don’t.',
      'Make it structured, premium, readable and useful as a brand guide.',
      'No random poster, no multi-page document, no unrelated mockups.',
    ],
    'offer-flyer': [
      `Create ONE professional one-page offer flyer for "${name}".`,
      `Offer context: ${brandLine}.`,
      'Layout: big headline, short subheadline, 3 benefits, offer block, CTA footer.',
      'Use short Polish copy and clean visual hierarchy.',
      'No long paragraphs, no fake prices, no fake address, no overcrowded layout.',
      'No lorem ipsum, no English filler, no fabricated statistics, testimonials, awards or partner logos.',
    ],
    'instagram-post': [
      `Create ONE high-converting Instagram 4:5 post for "${name}".`,
      `Topic: ${brandLine}.`,
      'Mobile-first design: big hook, one clear visual focus, max 3 short points, one CTA.',
      'Use Polish copy, bold hierarchy, readable text, strong contrast.',
      'No carousel, no tiny text, no watermark, no messy layout.',
      'Keep the hook readable at phone-thumbnail size and use one reusable branded graphic motif.',
    ],
    'ad-banner': [
      `Create ONE premium wide advertising banner for "${name}".`,
      `Campaign context: ${brandLine}.`,
      'Layout: hero area, short headline, one benefit, one CTA button style.',
      'Make it clean, professional and conversion-focused.',
      'No fake badges, no fake guarantees, no fake countdown, no clutter.',
    ],
  };

  return [
    ...(promptByMaterial[material.id] || [
      `Create ONE professional ${material.title} for "${name}".`,
      `Business: ${brandLine}.`,
      'Keep it clean, readable, premium and consistent with the selected style.',
    ]),
    '',
    ...base,
    ...(materialVariant ? [
      `Selected production direction: ${materialVariant.title}`,
      `Direction instruction: ${materialVariant.promptInstruction}`,
      '',
    ] : []),
    'Universal rules:',
    '- generate exactly one finished design',
    '- use Polish language for visible copy',
    '- keep text very short and readable',
    '- no watermark',
    '- no unrelated objects',
  ].join('\n');
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [17, 24, 39];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function safePdfText(value: string) {
  return (value || '')
    .replace(/[ąćęłńóśźż]/g, (char) => ({
      ą: 'a',
      ć: 'c',
      ę: 'e',
      ł: 'l',
      ń: 'n',
      ó: 'o',
      ś: 's',
      ź: 'z',
      ż: 'z',
    }[char] || char))
    .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, (char) => ({
      Ą: 'A',
      Ć: 'C',
      Ę: 'E',
      Ł: 'L',
      Ń: 'N',
      Ó: 'O',
      Ś: 'S',
      Ź: 'Z',
      Ż: 'Z',
    }[char] || char));
}

function addWrappedText(pdf: PdfDocument, text: string, x: number, y: number, maxWidth: number, lineHeight = 6) {
  const lines = pdf.splitTextToSize(safePdfText(text || ''), maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawBrandbookHeader(pdf: PdfDocument, title: string, pageNumber: number, colors: string[]) {
  const [r, g, b] = hexToRgb(colors[0] || '#111827');
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, 210, 18, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text(safePdfText(title), 14, 11);
  pdf.text(String(pageNumber).padStart(2, '0'), 190, 11);
  pdf.setTextColor(17, 24, 39);
}

function addBrandbookPage(pdf: PdfDocument, title: string, pageNumber: number, colors: string[]) {
  if (pageNumber > 1) pdf.addPage();
  drawBrandbookHeader(pdf, title, pageNumber, colors);
}

async function loadPdfImage(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getPdfImageFormat(dataUrl: string) {
  return dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
}

async function generateBrandbookPdf(
  profile: Record<string, string>,
  themeId: string,
  customColors: string,
  selectedMaterials: MaterialTemplate[],
  generatedAssets: SavedCompanyAssistantAsset[] = [],
) {
  const theme = getTheme(themeId);
  const colors = previewColors(themeId, customColors);
  const logoAsset = generatedAssets.find((asset) => asset.assetType === 'logo' || asset.materialId === 'logo-concept');
  const logoDataUrl = await loadPdfImage(logoAsset?.signedUrl);
  const brandName = profile.companyName || 'Nazwa marki';
  const industry = profile.industry || 'Branza / specjalizacja';
  const offer = profile.offer || profile.specialization || 'Glowna oferta do doprecyzowania';
  const audience = profile.targetAudience || 'Klient docelowy nie zostal doprecyzowany';
  const cta = profile.cta || 'Napisz do nas';
  const avoid = profile.avoidList || 'Unikac chaosu, niskiej czytelnosci i przypadkowych elementow.';
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primary = hexToRgb(colors[0] || '#111827');
  const bg = hexToRgb(colors[1] || '#ffffff');
  const accent = hexToRgb(colors[2] || '#c9a227');

  // 1. Cover
  pdf.setFillColor(bg[0], bg[1], bg[2]);
  pdf.rect(0, 0, 210, 297, 'F');
  pdf.setFillColor(primary[0], primary[1], primary[2]);
  pdf.rect(0, 0, 210, 82, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.text('MINI BRANDBOOK', 16, 24);
  pdf.setFontSize(32);
  addWrappedText(pdf, brandName, 16, 48, 160, 11);
  pdf.setFontSize(12);
  pdf.text(safePdfText(industry), 16, 76);
  pdf.setTextColor(17, 24, 39);
  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.roundedRect(16, 112, 48, 48, 8, 8, 'F');
  pdf.setFontSize(18);
  pdf.text('Kierunek marki', 76, 124);
  pdf.setFontSize(11);
  addWrappedText(pdf, `Styl: ${theme.title}. Klimat fontu: ${theme.fontMood}. Oferta: ${offer}.`, 76, 136, 110, 6);
  pdf.setFontSize(9);
  pdf.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 16, 280);

  // 2. Logo direction
  addBrandbookPage(pdf, 'Logo / znak', 2, colors);
  pdf.setFontSize(22);
  pdf.text('Kierunek logo', 14, 38);
  pdf.setFontSize(11);
  let y = addWrappedText(pdf, `Logo powinno byc proste, czytelne i spojne z branza: ${industry}. Na start traktujemy to jako kierunek znaku, nie finalny plik SVG.`, 14, 52, 180, 7);
  y += 8;
  pdf.setDrawColor(primary[0], primary[1], primary[2]);
  pdf.setLineWidth(0.8);
  pdf.roundedRect(14, y, 82, 54, 5, 5);
  pdf.setFontSize(18);
  pdf.text(safePdfText(brandName.slice(0, 22)), 22, y + 24);
  pdf.setFontSize(9);
  pdf.text('Wersja podstawowa', 22, y + 40);
  pdf.roundedRect(110, y, 82, 54, 5, 5);
  if (logoDataUrl) {
    pdf.addImage(logoDataUrl, getPdfImageFormat(logoDataUrl), 118, y + 6, 38, 38);
    pdf.setFontSize(8);
    pdf.text('Logo z generatora', 160, y + 28);
  } else {
    pdf.setFillColor(primary[0], primary[1], primary[2]);
    pdf.circle(130, y + 26, 12, 'F');
    pdf.setFontSize(9);
    pdf.text('Uproszczony znak / avatar', 148, y + 28);
  }
  y += 75;
  pdf.setFontSize(14);
  pdf.text('Zasady', 14, y);
  pdf.setFontSize(10);
  addWrappedText(pdf, '- Nie rozciagac logo.\n- Nie dodawac przypadkowych efektow.\n- Zachowac kontrast i margines ochronny.\n- Uzywac wersji uproszczonej tam, gdzie jest malo miejsca.', 14, y + 10, 180, 6);

  // 3. Colors
  addBrandbookPage(pdf, 'Kolory marki', 3, colors);
  pdf.setFontSize(22);
  pdf.text('Paleta kolorow', 14, 38);
  pdf.setFontSize(10);
  addWrappedText(pdf, customColors ? `Uzytkownik podal kolory: ${customColors}. Maja priorytet nad presetem.` : `Paleta pochodzi ze stylu ${theme.title}.`, 14, 50, 180, 6);
  y = 70;
  colors.slice(0, 5).forEach((color, index) => {
    const rgb = hexToRgb(color);
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.roundedRect(18 + index * 36, y, 28, 28, 4, 4, 'F');
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(8);
    pdf.text(color, 18 + index * 36, y + 38);
  });
  pdf.setFontSize(12);
  pdf.text('Rekomendacja uzycia', 14, 130);
  pdf.setFontSize(10);
  addWrappedText(pdf, 'Kolor glowny: naglowki, CTA, mocne elementy. Kolor tla: duze powierzchnie. Kolor akcentu: przyciski, linie, ikony, male wyroznienia. Nie uzywac wszystkich kolorow naraz w kazdym materiale.', 14, 142, 180, 6);

  // 4. Typography
  addBrandbookPage(pdf, 'Typografia', 4, colors);
  pdf.setFontSize(22);
  pdf.text('Klimat fontow', 14, 38);
  pdf.setFontSize(12);
  addWrappedText(pdf, `Rekomendowany klimat: ${theme.fontMood}.`, 14, 52, 180, 7);
  pdf.setFontSize(24);
  pdf.text('Naglowek marki', 14, 82);
  pdf.setFontSize(14);
  pdf.text('Podtytul / komunikat wspierajacy', 14, 104);
  pdf.setFontSize(10);
  addWrappedText(pdf, 'Tekst zwykly powinien byc prosty, czytelny i bez zbednej ozdobnosci. CTA musi byc krotkie i natychmiast zrozumiale.', 14, 122, 175, 6);

  // 5. Visual style
  addBrandbookPage(pdf, 'Styl grafik', 5, colors);
  pdf.setFontSize(22);
  pdf.text('Jak maja wygladac grafiki', 14, 38);
  pdf.setFontSize(10);
  y = addWrappedText(pdf, `Styl: ${theme.description}. Materialy powinny byc spojne, czytelne i rozpoznawalne dla odbiorcy: ${audience}.`, 14, 52, 180, 6);
  y += 8;
  pdf.setFontSize(13);
  pdf.text('Uzywac', 14, y);
  pdf.setFontSize(10);
  y = addWrappedText(pdf, '- mocnych hierarchii tekstu\n- konsekwentnej palety\n- prostych ikon lub znakow\n- duzych marginesow\n- jasnego CTA', 14, y + 10, 80, 6);
  pdf.setFontSize(13);
  pdf.text('Unikac', 110, y - 40);
  pdf.setFontSize(10);
  addWrappedText(pdf, avoid, 110, y - 30, 80, 6);

  // 6. Communication
  addBrandbookPage(pdf, 'Komunikacja', 6, colors);
  pdf.setFontSize(22);
  pdf.text('Ton komunikacji', 14, 38);
  pdf.setFontSize(10);
  y = addWrappedText(pdf, `Ton: ${profile.tone || 'profesjonalny, prosty i konkretny'}. Glowny przekaz powinien prowadzic do CTA: ${cta}.`, 14, 52, 180, 6);
  y += 8;
  pdf.setFontSize(13);
  pdf.text('Przykladowe komunikaty', 14, y);
  pdf.setFontSize(10);
  addWrappedText(pdf, `- ${offer}\n- Umow sie i sprawdz dostepne terminy\n- Zobacz, jak ${brandName} moze pomoc w: ${industry}`, 14, y + 10, 180, 6);

  // 7. Starter materials
  addBrandbookPage(pdf, 'Materialy startowe', 7, colors);
  pdf.setFontSize(22);
  pdf.text('Co tworzyc w pierwszej kolejnosci', 14, 38);
  pdf.setFontSize(10);
  selectedMaterials.forEach((material, index) => {
    const top = 58 + index * 28;
    pdf.setDrawColor(220, 220, 220);
    pdf.roundedRect(14, top, 180, 20, 3, 3);
    pdf.setFontSize(12);
    pdf.text(safePdfText(material.title), 20, top + 8);
    pdf.setFontSize(8);
    pdf.text(safePdfText(`${material.category} / ${formatLabels[material.format] || material.format}`), 20, top + 15);
  });
  if (selectedMaterials.length === 0) {
    addWrappedText(pdf, 'Brak wybranych materialow. Rekomendowane: wizytowka, mini brandbook, post Instagram.', 14, 58, 180, 6);
  }

  // 8. Base prompt
  addBrandbookPage(pdf, 'Prompt bazowy marki', 8, colors);
  pdf.setFontSize(20);
  pdf.text('Brand context do generowania', 14, 38);
  pdf.setFontSize(9);
  addWrappedText(
    pdf,
    `Brand: ${brandName}. Branza: ${industry}. Odbiorca: ${audience}. Oferta: ${offer}. Wyroznik: ${profile.differentiator || 'do doprecyzowania'}. Ton: ${profile.tone || 'profesjonalny'}. Styl: ${theme.title}. Kolory: ${(customColors || colors.join(', '))}. CTA: ${cta}. Unikac: ${avoid}.`,
    14,
    52,
    180,
    5,
  );

  // 9. Generated brand assets
  addBrandbookPage(pdf, 'Wygenerowane elementy marki', 9, colors);
  pdf.setFontSize(20);
  pdf.text('Assety przypiete do firmy', 14, 38);
  pdf.setFontSize(9);
  if (generatedAssets.length === 0) {
    addWrappedText(pdf, 'Brak wygenerowanych grafik przypietych do tej firmy. Gdy wygenerujesz logo, wizytowke lub post z promptu firmowego, pojawi sie tutaj automatycznie.', 14, 52, 180, 5);
  } else {
    generatedAssets.slice(0, 12).forEach((asset, index) => {
      const top = 54 + index * 16;
      pdf.setDrawColor(220, 220, 220);
      pdf.roundedRect(14, top, 180, 11, 2, 2);
      pdf.setFontSize(8);
      pdf.text(safePdfText(`${asset.assetType === 'logo' ? 'LOGO' : 'MATERIAL'} — ${asset.materialTitle || asset.materialId || 'Grafika firmowa'} / ${asset.dimensions || 'format nieznany'}`), 18, top + 7);
    });
  }

  const fileName = `${brandName || 'brandbook'}-brandbook.pdf`
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-');
  pdf.save(fileName);
}

const CompanyAssistantV2 = () => {
  const navigate = useNavigate();
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const litePromptRef = useRef<HTMLTextAreaElement | null>(null);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('lite');
  const [liteStep, setLiteStep] = useState<LiteStep>('describe');
  const [liteDescription, setLiteDescription] = useState('');
  const [liteCompanyName, setLiteCompanyName] = useState('');
  const [liteIndustry, setLiteIndustry] = useState('');
  const [liteMaterialId, setLiteMaterialId] = useState('logo-concept');
  const [liteThemeId, setLiteThemeId] = useState('minimal-white');
  const [liteCustomColors, setLiteCustomColors] = useState('');
  const [liteLogoStyle, setLiteLogoStyle] = useState<LiteLogoStyle>('typographic-wordmark');
  const [liteMaterialVariantId, setLiteMaterialVariantId] = useState('');
  const [litePrompt, setLitePrompt] = useState('');
  const [liteNameIdeas, setLiteNameIdeas] = useState<NameIdea[]>([]);
  const [generatingLiteNames, setGeneratingLiteNames] = useState(false);
  const [step, setStep] = useState<ConversationStep>('describe');
  const [sessionId, setSessionId] = useState(() => window.localStorage.getItem(SESSION_STORAGE_KEY) || '');
  const [startMode, setStartMode] = useState<StartMode>('existing-business');
  const [description, setDescription] = useState('');
  const [analysis, setAnalysis] = useState<BriefAnalysis | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<AssistantQuestion | null>(null);
  const [questionHistory, setQuestionHistory] = useState<Array<{ question: AssistantQuestion; questionNumber: number }>>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answerText, setAnswerText] = useState('');
  const [selectedQuickReplies, setSelectedQuickReplies] = useState<string[]>([]);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [brandIdentity, setBrandIdentity] = useState({
    companyName: '',
    logoStatus: '',
    logoStyle: [] as string[],
    brandMood: [] as string[],
    logoNotes: '',
  });
  const [preferredNameStyles, setPreferredNameStyles] = useState<string[]>(['Prosta i czytelna', 'Nowoczesna']);
  const [nameIdeas, setNameIdeas] = useState<NameIdea[]>([]);
  const [generatingNames, setGeneratingNames] = useState(false);
  const [selectedArchetypeId, setSelectedArchetypeId] = useState('expert');
  const [sloganIdeas, setSloganIdeas] = useState<SloganIdea[]>([]);
  const [selectedSlogan, setSelectedSlogan] = useState('');
  const [contact, setContact] = useState({ contactPerson: '', jobTitle: '', phone: '', email: '', website: '', instagram: '' });
  const [styleRecommendations, setStyleRecommendations] = useState<StyleRecommendation[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState('minimal-white');
  const [customColors, setCustomColors] = useState('');
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [styleFilter, setStyleFilter] = useState<'all' | 'premium' | 'minimal' | 'bold' | 'local' | 'tech'>('all');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialVariants, setSelectedMaterialVariants] = useState<Record<string, string>>({});
  const [selectedLogoPromptStyle, setSelectedLogoPromptStyle] = useState<LogoPromptStyleId>('symbol-wordmark');
  const [logoTextMode, setLogoTextMode] = useState<LogoTextMode>('company-name');
  const [logoPromptNotes, setLogoPromptNotes] = useState('');
  const [promptWarnings, setPromptWarnings] = useState<string[]>([]);
  const [savedPackages, setSavedPackages] = useState<SavedCompanyAssistantPackage[]>([]);
  const [companyAssets, setCompanyAssets] = useState<SavedCompanyAssistantAsset[]>([]);

  const selectedMaterials = useMemo(
    () => materials.filter((material) => selectedMaterialIds.includes(material.id)),
    [selectedMaterialIds],
  );

  const currentStepIndex = Math.max(0, flowSteps.findIndex((item) => item.id === step));
  const estimatedSelectedMaterialsCost = selectedMaterials.reduce(
    (sum, material) => sum + (materialEstimatedCosts[material.id] || 60),
    0,
  );

  const materialPrompts = useMemo<SavedMaterialPrompt[]>(() => {
    const checked = validateBrief(profile, selectedThemeId, customColors);
    return selectedMaterials.map((material) => ({
      materialId: material.id,
      title: material.title,
      format: material.format,
      style: material.style,
      prompt: buildMaterialPrompt(
        checked.profile,
        material,
        selectedThemeId,
        customColors,
        selectedMaterialVariants[material.id],
      ),
    }));
  }, [customColors, profile, selectedMaterialIds, selectedMaterialVariants, selectedMaterials, selectedThemeId]);

  const currentSessionPackages = useMemo(
    () => savedPackages.filter((pack) => pack.profile?.sessionId === sessionId),
    [savedPackages, sessionId],
  );

  const approvedBrief = useMemo(
    () => validateBrief(profile, selectedThemeId, customColors).profile,
    [customColors, profile, selectedThemeId],
  );

  const loadCompanyPanel = async (activeSessionId = sessionId) => {
    try {
      const [packagesData, assetsData] = await Promise.all([
        vpsFetch<{ ok: boolean; packages: SavedCompanyAssistantPackage[] }>('/me/company-assistant-packages?limit=20'),
        activeSessionId
          ? vpsFetch<{ ok: boolean; assets: SavedCompanyAssistantAsset[] }>(`/me/company-assistant-assets?sessionId=${encodeURIComponent(activeSessionId)}&limit=50`)
          : Promise.resolve({ ok: true, assets: [] as SavedCompanyAssistantAsset[] }),
      ]);
      setSavedPackages(packagesData.packages || []);
      setCompanyAssets(assetsData.assets || []);
    } catch {
      // Panel jest dodatkiem — nie blokujemy kreatora, jeśli użytkownik nie ma jeszcze sesji lub pakietów.
    }
  };

  useEffect(() => {
    void loadCompanyPanel(sessionId);
  }, []);

  const startAnalysis = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 8) {
      toast.error('Wpisz chociaż jedno konkretne zdanie.');
      return;
    }

    setSessionId('');
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSavedPackages([]);
    setCompanyAssets([]);
    setStep('analyzing');
    try {
      const result = await vpsFetch<BriefAnalysis & { ok: boolean; sessionId: string }>('/company-assistant/analyze-brief', {
        method: 'POST',
        body: JSON.stringify({ description: trimmed, startMode, forceNew: true }),
      });
      setSessionId(result.sessionId);
      window.localStorage.setItem(SESSION_STORAGE_KEY, result.sessionId);
      void loadCompanyPanel(result.sessionId);
      setAnalysis(result);
      setAnswers([]);
      setQuestionHistory([]);
      setQuestionNumber(1);
      setProfile({
        startMode,
        industry: result.detectedIndustry,
        stage: result.stage,
        ...Object.fromEntries(Object.entries(result.knownFacts || {}).map(([key, value]) => [key, String(value)])),
      });
      setBrandIdentity({
        companyName: String(result.knownFacts?.companyName || ''),
        logoStatus: String(result.knownFacts?.logoStatus || ''),
        logoStyle: String(result.knownFacts?.logoStyle || '').split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
        brandMood: String(result.knownFacts?.brandMood || '').split(/[,;\n]/).map((item) => item.trim()).filter(Boolean),
        logoNotes: String(result.knownFacts?.logoNotes || ''),
      });
      setNameIdeas([]);
      setGeneratingNames(false);
      setSloganIdeas([]);
      setSelectedSlogan('');
      setSelectedArchetypeId('expert');
      setSelectedLogoPromptStyle('symbol-wordmark');
      setLogoTextMode('company-name');
      setLogoPromptNotes('');
      setSelectedMaterialIds(result.recommendedMaterials.filter((id) => materials.some((material) => material.id === id)));

      if (result.confidence < 0.5 || result.missingFields.includes('description')) {
        setQuestion({
          field: 'description',
          text: 'Doprecyzuj krótko: co to za firma lub pomysł i jaki efekt chcesz osiągnąć?',
          quickReplies: [],
          allowCustom: true,
          allowSkip: false,
        });
        setStep('questions');
        return;
      }

      await loadNextQuestion(result, [], 1);
    } catch (error) {
      console.error(error);
      toast.error('Nie udało się przeanalizować opisu.');
      setStep('describe');
    }
  };

  const loadNextQuestion = async (currentAnalysis = analysis, currentAnswers = answers, nextNumber = questionNumber) => {
    if (!currentAnalysis) return;
    try {
      const result = await vpsFetch<NextQuestionResponse>('/company-assistant/next-question', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          analysis: currentAnalysis,
          answers: currentAnswers,
          questionNumber: nextNumber,
        }),
      });

      if (result.done) {
        const draft = {
          ...profile,
          ...(result.profileDraft || {}),
          industry: result.profileDraft?.industry || currentAnalysis.detectedIndustry,
          stage: result.profileDraft?.stage || currentAnalysis.stage,
        };
        setProfile(draft);
        setStep('brand');
        return;
      }

      setQuestion(result.question || null);
      setQuestionNumber(nextNumber);
      setAnswerText('');
      setSelectedQuickReplies([]);
      setStep('questions');
    } catch (error) {
      console.error(error);
      toast.warning('Nie udało się pobrać kolejnego pytania. Przejdźmy dalej z tym, co już mamy.');
      setStep('brand');
    }
  };

  const submitAnswer = async (value: string) => {
    if (!question || !analysis) return;
    const customValue = value.trim();
    const answer = customValue === 'skipped'
      ? 'skipped'
      : Array.from(new Set([...selectedQuickReplies, customValue].map((item) => item.trim()).filter(Boolean))).join(', ');

    if (!answer) {
      toast.error('Zaznacz odpowiedź albo wpisz własną.');
      return;
    }

    const nextAnswers = [...answers, { field: question.field, question: question.text, answer }];
    setAnswers(nextAnswers);
    setQuestionHistory((current) => [...current, { question, questionNumber }]);

    if (answer !== 'skipped') {
      setProfile((current) => ({ ...current, [question.field]: answer }));
    }

    await loadNextQuestion(analysis, nextAnswers, questionNumber + 1);
  };

  const goBack = () => {
    if (step === 'questions') {
      const lastHistoryItem = questionHistory[questionHistory.length - 1];
      const lastAnswer = answers[answers.length - 1];

      if (lastHistoryItem && lastAnswer) {
        setQuestion(lastHistoryItem.question);
        setQuestionNumber(lastHistoryItem.questionNumber);
        setAnswerText(lastAnswer.answer === 'skipped' ? '' : lastAnswer.answer);
        setSelectedQuickReplies([]);
        setAnswers((current) => current.slice(0, -1));
        setQuestionHistory((current) => current.slice(0, -1));
        setProfile((current) => {
          const next = { ...current };
          delete next[lastAnswer.field];
          return next;
        });
        return;
      }

      setStep('describe');
      return;
    }

    const previousStep: Partial<Record<ConversationStep, ConversationStep>> = {
      brand: question ? 'questions' : 'describe',
      contact: 'brand',
      styles: 'contact',
      mirror: 'styles',
      materials: 'mirror',
      logo: 'materials',
      prompts: 'materials',
    };

    const target = previousStep[step];
    if (target) setStep(target);
  };

  const toggleBrandChoice = (field: 'logoStyle' | 'brandMood', value: string) => {
    setBrandIdentity((current) => {
      const values = current[field];
      return {
        ...current,
        [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  };

  const toggleNameStyle = (value: string) => {
    setPreferredNameStyles((current) => (
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    ));
  };

  const generateNameIdeas = async () => {
    setGeneratingNames(true);
    try {
      const data = await vpsFetch<{ ok: boolean; names: NameIdea[] }>('/company-assistant/generate-names', {
        method: 'POST',
        body: JSON.stringify({
          description,
          profile: { ...profile, ...brandIdentity },
          preferredStyles: preferredNameStyles,
        }),
      });
      const ideas = data.names || [];
      setNameIdeas(ideas);
      if (!ideas.length) {
        toast.error('Model nie zwrócił nazw. Dopisz krótko branżę lub ofertę w briefie.');
        return;
      }
      toast.success('Wygenerowano nazwy przez model AI');
    } catch (error) {
      console.error(error);
      const ideas = generateCompanyNameIdeas({ ...profile, ...brandIdentity }, description, preferredNameStyles);
      setNameIdeas(ideas);
      if (!ideas.length) {
        toast.error('Nie udało się przygotować nazw. Dopisz krótko branżę lub ofertę w briefie.');
        return;
      }
      toast.warning('AI naming chwilowo niedostępny — pokazuję awaryjne propozycje.');
    } finally {
      setGeneratingNames(false);
    }
  };

  const generateLiteNameIdeas = async () => {
    if (liteDescription.trim().length < 8 && !liteIndustry.trim()) {
      toast.error('Najpierw opisz krótko firmę albo pomysł, żebym miał z czego zaproponować nazwę.');
      return;
    }

    setGeneratingLiteNames(true);
    try {
      const data = await vpsFetch<{ ok: boolean; names: NameIdea[] }>('/company-assistant/generate-names', {
        method: 'POST',
        body: JSON.stringify({
          description: liteDescription,
          profile: {
            industry: liteIndustry,
            offer: liteDescription,
            stage: 'starting',
          },
          preferredStyles: ['Prosta i czytelna', 'Nowoczesna', 'Krótka'],
        }),
      });
      const ideas = data.names || [];
      setLiteNameIdeas(ideas);
      if (!ideas.length) {
        toast.error('Model nie zwrócił nazw. Dopisz jedno zdanie więcej o branży lub ofercie.');
        return;
      }
      toast.success('Wygenerowano propozycje nazw');
    } catch (error) {
      console.error(error);
      const ideas = generateCompanyNameIdeas(
        { industry: liteIndustry, offer: liteDescription, targetAudience: '', tone: 'nowoczesny' },
        liteDescription,
        ['Prosta i czytelna', 'Nowoczesna', 'Krótka'],
      );
      setLiteNameIdeas(ideas);
      if (!ideas.length) {
        toast.error('Nie udało się przygotować nazw. Dopisz branżę albo ofertę.');
        return;
      }
      toast.warning('AI naming chwilowo niedostępny — pokazuję awaryjne propozycje.');
    } finally {
      setGeneratingLiteNames(false);
    }
  };

  const useNameIdea = (name: string) => {
    setBrandIdentity((current) => ({ ...current, companyName: name }));
    toast.success(`Wybrano nazwę: ${name}`);
  };

  const useLiteNameIdea = (name: string) => {
    setLiteCompanyName(name);
    toast.success(`Wybrano nazwę: ${name}`);
  };


  const generateSlogans = () => {
    const ideas = generateSloganIdeas({ ...profile, ...brandIdentity, mainMessage: selectedSlogan }, selectedArchetypeId);
    setSloganIdeas(ideas);
    if (!ideas.length) {
      toast.error('Nie udało się przygotować sloganów. Dopisz ofertę albo klienta w briefie.');
      return;
    }
    toast.success('Wygenerowano slogany');
  };

  const useSloganIdea = (text: string) => {
    setSelectedSlogan(text);
    toast.success('Slogan zapisany do briefu');
  };

  const selectStartMode = (mode: typeof startModes[number]) => {
    setStartMode(mode.id);
    if (!description.trim()) setDescription(mode.examples[0] || '');
    window.setTimeout(() => {
      descriptionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      descriptionTextareaRef.current?.focus({ preventScroll: true });
    }, 80);
  };

  const goToContact = () => {
    const companyName = brandIdentity.companyName.trim();
    if (!isRealCompanyName(companyName)) {
      toast.error('Najpierw wpisz albo wygeneruj nazwę firmy. Bez nazwy logo i materiały marki wychodzą słabo.');
      return;
    }

    const logoStatus = brandIdentity.logoStatus.trim();
    const logoStyle = brandIdentity.logoStyle.join(', ');
    const brandMood = brandIdentity.brandMood.join(', ');
    const logoNotes = brandIdentity.logoNotes.trim();
    const archetype = brandArchetypes.find((item) => item.id === selectedArchetypeId) || brandArchetypes[0];

    setProfile((current) => ({
      ...current,
      companyName,
      logoStatus,
      logoStyle,
      brandMood,
      logoNotes,
      brandArchetype: archetype.title,
      brandArchetypeId: archetype.id,
      brandArchetypeTone: archetype.tone,
      brandArchetypePromptHint: archetype.promptHint,
      slogan: selectedSlogan,
      mainMessage: selectedSlogan || current.mainMessage,
      tone: current.tone || archetype.tone,
    }));
    setStep('contact');
  };

  const goToStyles = async () => {
    const mergedProfile = { ...profile, ...contact };
    setProfile(mergedProfile);
    setStep('styles');
    try {
      const data = await vpsFetch<{ ok: boolean; recommendations: StyleRecommendation[] }>('/company-assistant/recommend-styles', {
        method: 'POST',
        body: JSON.stringify({ sessionId, profile: mergedProfile }),
      });
      setStyleRecommendations(data.recommendations || []);
      const first = data.recommendations?.[0];
      if (first?.themeId) setSelectedThemeId(first.themeId);
    } catch (error) {
      console.error(error);
      const fallbackThemes = (analysis?.recommendedThemes || ['minimal-white', 'editorial-magazine', 'mono-luxury']).slice(0, 3);
      setStyleRecommendations(fallbackThemes.map((themeId) => ({
        themeId,
        reason: 'Fallback: styl pasuje do podstawowego profilu marki.',
        colors: getTheme(themeId).colors,
        fontMood: getTheme(themeId).fontMood,
      })));
      setSelectedThemeId(fallbackThemes[0] || 'minimal-white');
    }
  };

  const confirmMirror = () => {
    const recommended = analysis?.recommendedMaterials || [];
    const nextSelected = recommended.filter((id) => materials.some((material) => material.id === id));
    setSelectedMaterialIds(nextSelected.length > 0 ? nextSelected : ['business-card', 'brandbook', 'instagram-post']);
    setStep('materials');
  };

  const buildPrompts = (profileOverride = profile) => {
    if (selectedMaterialsNeedCompanyName(selectedMaterialIds) && !isRealCompanyName(profileOverride.companyName)) {
      toast.error('Najpierw wpisz albo wygeneruj nazwę firmy. Logo, wizytówka i brandbook potrzebują konkretnej nazwy.');
      setStep('brand');
      return;
    }

    if (selectedMaterialIds.includes('logo-concept') && !profileOverride.logoPromptStyleId) {
      setStep('logo');
      return;
    }

    const checked = validateBrief(profileOverride, selectedThemeId, customColors);
    const quality = buildLocalBriefQuality(checked.profile, analysis);
    setProfile(checked.profile);
    setPromptWarnings([
      ...checked.warnings,
      ...quality.conflicts.map((item) => `Konflikt w briefie: ${item}`),
      ...(quality.level === 'weak' ? ['Brief jest słaby — warto uzupełnić braki w brief-lustrze przed generowaniem.'] : []),
    ]);
    if (!checked.profile.industry) {
      toast.error('Uzupełnij branżę w briefie.');
      setStep('mirror');
      return;
    }
    if (quality.conflicts.length > 0) {
      toast.error('Sprawdź konflikty w briefie przed generowaniem promptów.');
      setStep('mirror');
      return;
    }
    setStep('prompts');
  };

  const confirmLogoPromptStyle = () => {
    if (!isRealCompanyName(profile.companyName)) {
      toast.error('Najpierw wybierz konkretną nazwę firmy — bez tego logo będzie losowe i słabsze.');
      setStep('brand');
      return;
    }

    const logoStyle = getLogoPromptStyle(selectedLogoPromptStyle);
    const nextProfile = {
      ...profile,
      logoPromptStyleId: selectedLogoPromptStyle,
      logoPromptStyleTitle: logoStyle.title,
      logoPromptStyleInstruction: logoStyle.promptInstruction,
      logoPromptStyleAvoid: logoStyle.avoid,
      logoTextMode,
      logoPromptNotes: logoPromptNotes.trim(),
      logoStyle: [
        profile.logoStyle,
        logoStyle.title,
        logoTextMode === 'company-name' ? 'tekst: dokładna nazwa firmy' : '',
        logoTextMode === 'symbol-only' ? 'bez tekstu, sam znak' : '',
        logoTextMode === 'monogram' ? 'monogram / inicjały' : '',
        logoPromptNotes.trim(),
      ].filter(Boolean).join(', '),
    };
    setProfile(nextProfile);
    buildPrompts(nextProfile);
  };

  const downloadBrandbookPdf = async (packageOverride?: SavedCompanyAssistantPackage) => {
    const packageProfile = packageOverride?.profile || profile;
    const packageThemeId = packageProfile.selectedThemeId || selectedThemeId;
    const packageCustomColors = packageProfile.customColors || customColors;
    const packageMaterials = packageOverride
      ? materials.filter((material) => packageOverride.prompts.some((prompt) => prompt.materialId === material.id))
      : selectedMaterials;
    const packageAssets = packageOverride
      ? companyAssets.filter((asset) => asset.packageId === packageOverride.id || asset.sessionId === packageProfile.sessionId)
      : companyAssets;
    const checked = validateBrief(packageOverride ? packageProfile : profile, packageThemeId, packageCustomColors);
    if (!checked.profile.industry) {
      toast.error('Uzupełnij branżę w briefie przed pobraniem brandbooka.');
      setStep('mirror');
      return;
    }

    if (!packageOverride) setProfile(checked.profile);
    setPromptWarnings(checked.warnings);
    await generateBrandbookPdf(checked.profile, packageThemeId, packageCustomColors, packageMaterials, packageAssets);
    toast.success('Brandbook PDF wygenerowany');
  };

  const savePromptPackage = async () => {
    try {
      const data = await vpsFetch<{ ok: boolean; package: SavedCompanyAssistantPackage }>('/me/company-assistant-packages', {
        method: 'POST',
        body: JSON.stringify({
          companyName: profile.companyName || 'Projekt bez nazwy',
          industry: profile.industry || 'Branża nieuzupełniona',
          profile: {
            ...profile,
            selectedThemeId,
            customColors,
            sessionId,
            brandbook: {
              selectedThemeId,
              customColors,
              materialIds: selectedMaterialIds,
              createdAt: new Date().toISOString(),
            },
          },
          prompts: materialPrompts,
        }),
      });
      if (data.package) {
        setSavedPackages((current) => [data.package, ...current.filter((item) => item.id !== data.package.id)].slice(0, 20));
        toast.success('Pakiet zapisany w panelu użytkownika');
        return data.package;
      }
      toast.success('Pakiet zapisany w panelu użytkownika');
    } catch (error) {
      console.error(error);
      toast.error('Nie udało się zapisać pakietu.');
    }
  };

  const ensurePromptPackage = async () => {
    const activePackage = savedPackages.find((pack) => pack.profile?.sessionId === sessionId);
    if (activePackage) return activePackage;

    toast.info('Zapisuję pakiet firmy przed przejściem do generatora.');
    return await savePromptPackage();
  };

  const usePromptInGenerator = async (prompt: SavedMaterialPrompt) => {
    const activePackage = await ensurePromptPackage();
    if (!activePackage) return;

    window.sessionStorage.setItem('companyAssistantPrompt', prompt.prompt);
    window.sessionStorage.setItem('companyAssistantFormat', prompt.format);
    window.sessionStorage.setItem('companyAssistantStyle', prompt.style);
    window.sessionStorage.setItem('companyAssistantContext', JSON.stringify({
      packageId: activePackage.id,
      sessionId: activePackage.profile?.sessionId || sessionId,
      materialId: prompt.materialId,
      materialTitle: prompt.title,
      selectedThemeId,
      customColors,
      companyName: activePackage.companyName || profile.companyName || '',
      industry: activePackage.industry || profile.industry || '',
    }));
    navigate('/generator');
  };

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    toast.success('Prompt skopiowany');
  };

  const liteMaterial = materials.find((item) => item.id === liteMaterialId) || materials[0];
  const liteProgress = liteStep === 'describe' ? 20 : liteStep === 'name' ? 40 : liteStep === 'material' ? 60 : liteStep === 'style' ? 80 : 100;

  const goToLiteName = () => {
    if (liteDescription.trim().length < 8) {
      toast.error('Napisz jedno konkretne zdanie o firmie lub pomyśle.');
      return;
    }
    setLiteStep('name');
  };

  const goToLiteMaterial = () => {
    if (!isRealCompanyName(liteCompanyName)) {
      toast.error('Najpierw wpisz albo wybierz nazwę firmy z propozycji AI.');
      return;
    }
    setLiteStep('material');
  };

  const buildLitePromptAndShow = () => {
    if (materialIdsRequiringCompanyName.has(liteMaterial.id) && !isRealCompanyName(liteCompanyName)) {
      toast.error('Najpierw wpisz albo wygeneruj nazwę firmy. Logo, wizytówka i brandbook potrzebują konkretnej nazwy.');
      setLiteStep('describe');
      return;
    }

    const nextPrompt = buildLiteCompanyPrompt({
      description: liteDescription,
      material: liteMaterial,
      themeId: liteThemeId,
      companyName: liteCompanyName,
      industry: liteIndustry,
      customColors: liteCustomColors,
      logoStyle: liteLogoStyle,
      materialVariantId: liteMaterialVariantId,
    });
    setLitePrompt(nextPrompt);
    setLiteStep('prompt');
    window.setTimeout(() => litePromptRef.current?.focus({ preventScroll: true }), 80);
  };

  const useLitePromptInGenerator = () => {
    const prompt = litePrompt || buildLiteCompanyPrompt({
      description: liteDescription,
      material: liteMaterial,
      themeId: liteThemeId,
      companyName: liteCompanyName,
      industry: liteIndustry,
      customColors: liteCustomColors,
      logoStyle: liteLogoStyle,
      materialVariantId: liteMaterialVariantId,
    });
    window.sessionStorage.setItem('companyAssistantPrompt', prompt);
    window.sessionStorage.setItem('companyAssistantFormat', liteMaterial.format);
    window.sessionStorage.setItem('companyAssistantStyle', liteMaterial.style);
    window.sessionStorage.setItem('companyAssistantContext', JSON.stringify({
      packageId: '',
      sessionId: '',
      materialId: liteMaterial.id,
      materialTitle: liteMaterial.title,
      selectedThemeId: liteThemeId,
      customColors: liteCustomColors,
      logoStyle: liteLogoStyle,
      materialVariantId: getMaterialVariant(liteMaterial.id, liteMaterialVariantId)?.id || '',
      companyName: liteCompanyName,
      industry: liteIndustry,
      lite: true,
    }));
    navigate('/generator');
  };

  const startOver = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId('');
    setStartMode('existing-business');
    setDescription('');
    setAnalysis(null);
    setAnswers([]);
    setQuestion(null);
    setQuestionHistory([]);
    setQuestionNumber(1);
    setAnswerText('');
    setSelectedQuickReplies([]);
    setProfile({});
    setBrandIdentity({ companyName: '', logoStatus: '', logoStyle: [], brandMood: [], logoNotes: '' });
    setPreferredNameStyles(['Prosta i czytelna', 'Nowoczesna']);
    setNameIdeas([]);
    setGeneratingNames(false);
    setLiteNameIdeas([]);
    setGeneratingLiteNames(false);
    setSelectedArchetypeId('expert');
    setSloganIdeas([]);
    setSelectedSlogan('');
    setContact({ contactPerson: '', jobTitle: '', phone: '', email: '', website: '', instagram: '' });
    setStyleRecommendations([]);
    setSelectedThemeId('minimal-white');
    setCustomColors('');
    setShowAllStyles(false);
    setStyleFilter('all');
    setSelectedMaterialIds([]);
    setSelectedLogoPromptStyle('symbol-wordmark');
    setLogoTextMode('company-name');
    setLogoPromptNotes('');
    setPromptWarnings([]);
    setSavedPackages([]);
    setCompanyAssets([]);
    setStep('describe');
    setLiteStep('describe');
    setLiteDescription('');
    setLiteCompanyName('');
    setLiteIndustry('');
    setLiteMaterialId('logo-concept');
    setLiteThemeId('minimal-white');
    setLiteCustomColors('');
    setLiteLogoStyle('typographic-wordmark');
    setLitePrompt('');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <BriefcaseBusiness className="mr-2 inline h-7 w-7 text-primary" />
              Asystent firmowy <span className="gradient-text">{assistantMode === 'lite' ? 'Lite' : 'V2'}</span>
            </h1>
            <p className="mt-1 text-muted-foreground">
              {assistantMode === 'lite'
                ? 'Prosta ścieżka: opis, materiał, styl i krótki konkretny prompt.'
                : 'Rozmowa zamiast formularza: opis, analiza, pytania, styl, brief i prompty.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={assistantMode === 'lite' ? 'default' : 'outline'}
              className={assistantMode === 'lite' ? 'gradient-bg' : ''}
              onClick={() => setAssistantMode('lite')}
            >
              Tryb prosty
            </Button>
            <Button
              variant={assistantMode === 'advanced' ? 'default' : 'outline'}
              className={assistantMode === 'advanced' ? 'gradient-bg' : ''}
              onClick={() => setAssistantMode('advanced')}
            >
              Tryb zaawansowany
            </Button>
            <Button variant="outline" onClick={startOver}>Nowy projekt</Button>
          </div>
        </div>

        {assistantMode === 'lite' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {liteStep === 'describe' && 'Krok 1 z 5: Opis'}
                    {liteStep === 'name' && 'Krok 2 z 5: Nazwa'}
                    {liteStep === 'material' && 'Krok 3 z 5: Materiał'}
                    {liteStep === 'style' && 'Krok 4 z 5: Styl'}
                    {liteStep === 'prompt' && 'Krok 5 z 5: Prompt'}
                  </span>
                  <span className="text-muted-foreground">{liteProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full gradient-bg transition-all" style={{ width: `${liteProgress}%` }} />
                </div>
              </CardContent>
            </Card>

            {liteStep === 'describe' && (
              <Card>
                <CardHeader>
                  <CardTitle>Opisz firmę albo pomysł</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Jedno lub kilka zdań wystarczy. Bez formularzy i bez dopytywania o wszystko.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={liteDescription}
                    onChange={(event) => setLiteDescription(event.target.value)}
                    className="min-h-[150px]"
                    placeholder="np. Robię automatyzacje AI dla małych firm. Chcę wyglądać nowocześnie i profesjonalnie. Potrzebuję logo i wizytówki."
                  />
                  <Input value={liteIndustry} onChange={(event) => setLiteIndustry(event.target.value)} placeholder="Branża / specjalizacja, opcjonalnie" />
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Studio tatuażu premium, czarne logo, wizytówka i post na Instagram.',
                      'Automatyzacje AI dla małych firm, styl tech, logo i oferta.',
                      'Firma remontowa: malowanie, tapetowanie, elektryka. Chcę wizytówkę i ulotkę.',
                    ].map((example) => (
                      <Button key={example} type="button" variant="outline" size="sm" className="h-auto whitespace-normal text-left" onClick={() => setLiteDescription(example)}>
                        {example}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button className="gradient-bg" onClick={goToLiteName}>Dalej do nazwy</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {liteStep === 'name' && (
              <Card>
                <CardHeader>
                  <CardTitle>Wybierz nazwę firmy</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Nazwa jest potrzebna, zanim zrobimy logo, wizytówkę albo brandbook. Wpisz własną albo wygeneruj propozycje AI.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={liteCompanyName}
                    onChange={(event) => setLiteCompanyName(event.target.value)}
                    placeholder="Wpisz nazwę firmy albo wybierz jedną z propozycji"
                  />
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">Nie masz jeszcze nazwy?</p>
                        <p className="text-sm text-muted-foreground">
                          Wygeneruję kilka propozycji na podstawie opisu, branży i stylu marki.
                        </p>
                      </div>
                      <Button type="button" className="gradient-bg shrink-0" onClick={generateLiteNameIdeas} disabled={generatingLiteNames}>
                        {generatingLiteNames ? 'Generuję nazwy...' : 'Zaproponuj nazwy AI'}
                      </Button>
                    </div>
                    {liteNameIdeas.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {liteNameIdeas.slice(0, 6).map((idea) => (
                          <button
                            key={`${idea.name}-${idea.style}`}
                            type="button"
                            onClick={() => useLiteNameIdea(idea.name)}
                            className={cn(
                              'rounded-xl border bg-background p-3 text-left transition hover:border-primary hover:shadow-sm',
                              liteCompanyName === idea.name && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{idea.name}</p>
                                <p className="text-xs text-primary">{idea.style}</p>
                              </div>
                              {liteCompanyName === idea.name && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{idea.reason}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="outline" onClick={() => setLiteStep('name')}>Wstecz</Button>
                    <div className="flex flex-col items-end gap-1">
                      {!isRealCompanyName(liteCompanyName) && (
                        <p className="text-xs text-muted-foreground">Wpisz albo wybierz nazwę, żeby przejść dalej.</p>
                      )}
                      <Button className="gradient-bg" onClick={goToLiteMaterial} disabled={!isRealCompanyName(liteCompanyName)}>
                        Dalej do materiału
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {liteStep === 'material' && (
              <Card>
                <CardHeader>
                  <CardTitle>Co chcesz wygenerować?</CardTitle>
                  <p className="text-sm text-muted-foreground">Wybierz jeden materiał. Każdy ma osobny, krótki prompt.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {materials.filter((item) => liteMaterialIds.includes(item.id)).map((material) => {
                      const selected = liteMaterialId === material.id;
                      return (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => {
                            setLiteMaterialId(material.id);
                            setLiteMaterialVariantId(getMaterialVariants(material.id)[0]?.id || '');
                          }}
                          className={cn(
                            'rounded-2xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                            selected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{material.title}</p>
                              <p className="text-xs text-primary">{formatLabels[material.format] || material.format}</p>
                            </div>
                            {selected && <Check className="h-5 w-5 text-primary" />}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{material.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  {liteMaterialId === 'logo-concept' && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <p className="font-semibold">Jak ma wyglądać logo?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Jeśli chcesz efekt jak na przykładzie — wybierz „Nazwa jako logo”. Model skupi się na literach, nie na obrazku obok.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          {
                            id: 'typographic-wordmark',
                            title: 'Nazwa jako logo',
                            desc: 'Modyfikowane litery, custom lettering, bez osobnej ikonki.',
                            preview: liteCompanyName || 'ENILO',
                          },
                          {
                            id: 'symbol-wordmark',
                            title: 'Ikona + nazwa',
                            desc: 'Osobny znak obok czytelnej nazwy firmy.',
                            preview: `⬡ ${liteCompanyName || 'ENILO'}`,
                          },
                          {
                            id: 'lettermark',
                            title: 'Litera + nazwa',
                            desc: 'Pierwsza litera/inicjały jako znak połączony z nazwą.',
                            preview: `${(liteCompanyName || 'E').slice(0, 1).toUpperCase()} ${liteCompanyName || 'ENILO'}`,
                          },
                        ].map((option) => {
                          const selected = liteLogoStyle === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setLiteLogoStyle(option.id as LiteLogoStyle)}
                              className={cn(
                                'rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                                selected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold">{option.title}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{option.desc}</p>
                                </div>
                                {selected && <Check className="h-4 w-4 text-primary" />}
                              </div>
                              <div className="mt-3 rounded-lg border bg-slate-950 px-3 py-4 text-center text-sm font-black uppercase tracking-[0.18em] text-white">
                                {option.preview}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {getMaterialVariants(liteMaterialId).length > 0 && (
                    <div className="rounded-2xl border bg-muted/20 p-4">
                      <p className="font-semibold">Wybierz układ i cel materiału</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        To zmienia kompozycję promptu, więc materiały nie będą wyglądały za każdym razem tak samo.
                      </p>
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {getMaterialVariants(liteMaterialId).map((variant) => {
                          const activeVariantId = liteMaterialVariantId || getMaterialVariants(liteMaterialId)[0]?.id;
                          const selected = activeVariantId === variant.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setLiteMaterialVariantId(variant.id)}
                              className={cn(
                                'rounded-xl border bg-background p-3 text-left transition hover:border-primary',
                                selected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">{variant.title}</p>
                                {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{variant.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="outline" onClick={() => setLiteStep('describe')}>Wstecz</Button>
                    <Button className="gradient-bg" onClick={() => setLiteStep('style')}>Dalej</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {liteStep === 'style' && (
              <Card>
                <CardHeader>
                  <CardTitle>Wybierz styl</CardTitle>
                  <p className="text-sm text-muted-foreground">Tylko najważniejszy kierunek. Bez archetypów i długich ustawień.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {liteStyleOptions.map((style) => {
                      const theme = getTheme(style.id);
                      const selected = liteThemeId === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setLiteThemeId(style.id)}
                          className={cn(
                            'rounded-2xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                            selected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{style.label}</p>
                              <p className="text-sm text-muted-foreground">{style.helper}</p>
                            </div>
                            {selected && <Check className="h-5 w-5 text-primary" />}
                          </div>
                          <Swatches colors={theme.colors} />
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    value={liteCustomColors}
                    onChange={(event) => setLiteCustomColors(event.target.value)}
                    placeholder="Własne kolory, opcjonalnie: np. granat, biały, niebieski albo #0f172a, #ffffff, #38bdf8"
                  />
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="outline" onClick={() => setLiteStep('material')}>Wstecz</Button>
                    <Button className="gradient-bg" onClick={buildLitePromptAndShow}>Pokaż prompt</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {liteStep === 'prompt' && (
              <Card>
                <CardHeader>
                  <CardTitle>Gotowy prompt</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Krótki prompt pod wybrany materiał. Jeśli grafika ma mieć dużo tekstu, lepiej wygenerować tło i dodać napisy w edytorze.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea ref={litePromptRef} value={litePrompt} onChange={(event) => setLitePrompt(event.target.value)} className="min-h-[280px] text-xs leading-relaxed" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button variant="outline" onClick={() => setLiteStep('style')}>Wstecz</Button>
                    <Button variant="outline" className="gap-1.5" onClick={() => copyPrompt(litePrompt)}>
                      <Copy className="h-4 w-4" /> Kopiuj
                    </Button>
                    <Button className="gradient-bg gap-1.5" onClick={useLitePromptInGenerator}>
                      <Wand2 className="h-4 w-4" /> Przejdź do generatora
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">Chcesz lepszy brief i większą kontrolę?</p>
                        <p className="text-sm text-muted-foreground">
                          Tryb zaawansowany dopyta o nazwę, logo, klienta, styl, kolory i przygotuje osobne prompty do materiałów.
                        </p>
                      </div>
                      <Button className="gradient-bg shrink-0" onClick={() => setAssistantMode('advanced')}>
                        Otwórz tryb zaawansowany
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {assistantMode === 'advanced' && (
          <>
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Etap {currentStepIndex + 1} z {flowSteps.length}: {flowSteps[currentStepIndex]?.label}</span>
              <span className="text-muted-foreground">{Math.round(((currentStepIndex + 1) / flowSteps.length) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full gradient-bg transition-all"
                style={{ width: `${((currentStepIndex + 1) / flowSteps.length) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {flowSteps.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs',
                    index <= currentStepIndex ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {step === 'describe' && (
          <Card>
            <CardHeader>
              <CardTitle>Od czego zaczynamy?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Najpierw wybierz sytuację. Dzięki temu asystent nie będzie pytał jak działającą firmę, jeśli masz dopiero pomysł albo szukasz niszy.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {startModes.map((mode) => {
                  const selected = mode.id === startMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => selectStartMode(mode)}
                      className={cn(
                        'rounded-2xl border p-3 text-left transition hover:border-primary/70 hover:bg-primary/5',
                        selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{mode.title}</p>
                          <p className="text-xs text-primary">{mode.subtitle}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{mode.helper}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {mode.focus.slice(0, 2).map((item) => (
                          <span key={item} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                            {item}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div ref={descriptionSectionRef} className="scroll-mt-24 rounded-2xl border bg-muted/30 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Opisz krótko sytuację</p>
                    <p className="text-sm text-muted-foreground">
                      {startModes.find((mode) => mode.id === startMode)?.helper}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{description.trim().length}/4000</span>
                </div>
              </div>

              <Textarea
                ref={descriptionTextareaRef}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[150px]"
                placeholder={startModes.find((mode) => mode.id === startMode)?.placeholder}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium">Szybkie przykłady dla tej sytuacji</p>
                <div className="grid gap-2">
                  {(startModes.find((mode) => mode.id === startMode)?.examples || []).map((example) => (
                    <Button
                      key={example}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal rounded-xl py-3 text-left"
                      onClick={() => setDescription(example)}
                    >
                      <Wand2 className="mr-2 h-4 w-4 shrink-0 text-primary" />
                    {example}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-semibold">Co warto dopisać, jeśli wiesz?</p>
                <div className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
                  <span>• branża lub temat</span>
                  <span>• czy masz nazwę i logo</span>
                  <span>• dla kogo jest oferta</span>
                  <span>• jaki styl lub kolory lubisz</span>
                  <span>• co chcesz wygenerować</span>
                  <span>• czego unikać w materiałach</span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gradient-bg" onClick={startAnalysis}>Analizuj opis</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'analyzing' && (
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Analizuję Twój opis...</span>
            </CardContent>
          </Card>
        )}

        {step === 'questions' && question && (
          <Card>
            <CardHeader>
              <p className="text-sm text-muted-foreground">{analysis?.acknowledgement}</p>
              <CardTitle>Pytanie {Math.min(questionNumber, 5)} z ok. 5</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-xl font-semibold leading-snug">{question.text}</p>
              {question.quickReplies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Możesz zaznaczyć kilka opcji.</p>
                  <div className="flex flex-wrap gap-2">
                    {question.quickReplies.map((reply) => {
                      const selected = selectedQuickReplies.includes(reply);
                      return (
                        <Button
                          key={reply}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          className={selected ? 'gradient-bg' : ''}
                          onClick={() =>
                            setSelectedQuickReplies((current) =>
                              current.includes(reply)
                                ? current.filter((item) => item !== reply)
                                : [...current, reply],
                            )
                          }
                        >
                          {selected && <Check className="mr-1 h-4 w-4" />}
                          {reply}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              {question.allowCustom && (
                <div className="space-y-2">
                  <Textarea value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="Lub napisz własną odpowiedź" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="outline" onClick={goBack}>Wstecz</Button>
                    {question.allowSkip ? <Button variant="ghost" onClick={() => submitAnswer('skipped')}>Pomiń</Button> : <span />}
                    <Button className="gradient-bg" onClick={() => submitAnswer(answerText)}>Dalej</Button>
                  </div>
                </div>
              )}
              {!question.allowCustom && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" onClick={goBack}>Wstecz</Button>
                  {question.allowSkip ? <Button variant="ghost" onClick={() => submitAnswer('skipped')}>Pomiń</Button> : <span />}
                  <Button className="gradient-bg" onClick={() => submitAnswer(answerText)}>Dalej</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'brand' && (
          <Card>
            <CardHeader>
              <CardTitle>Nazwa i logo marki</CardTitle>
              <p className="text-sm text-muted-foreground">
                Te informacje najmocniej wpływają na logo, brandbook, wizytówkę i spójność kolejnych materiałów.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nazwa firmy lub nazwa robocza</label>
                <Input
                  value={brandIdentity.companyName}
                  onChange={(event) => setBrandIdentity((current) => ({ ...current, companyName: event.target.value }))}
                  placeholder="np. AutoFlow Pro — albo kliknij niżej, żeby AI zaproponowało nazwy"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBrandIdentity((current) => ({ ...current, companyName: '' }));
                      void generateNameIdeas();
                    }}
                  >
                    Nie mam nazwy — wygeneruj
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBrandIdentity((current) => ({ ...current, companyName: '' }));
                      void generateNameIdeas();
                    }}
                  >
                    Niech AI zaproponuje nazwę
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">Generator nazwy firmy</p>
                    <p className="text-sm text-muted-foreground">
                      Wybierz klimat nazwy, a aplikacja przygotuje propozycje na podstawie briefu, branży i oferty.
                    </p>
                  </div>
                  <Button type="button" className="gradient-bg shrink-0" onClick={generateNameIdeas} disabled={generatingNames}>
                    {generatingNames ? 'Generuję TOP nazwy...' : 'Wygeneruj nazwy AI'}
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nameStyleOptions.map((option) => {
                    const selected = preferredNameStyles.includes(option);
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className={selected ? 'gradient-bg' : ''}
                        onClick={() => toggleNameStyle(option)}
                      >
                        {selected && <Check className="mr-1 h-3.5 w-3.5" />}
                        {option}
                      </Button>
                    );
                  })}
                </div>
                {nameIdeas.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {nameIdeas.map((idea) => (
                      <button
                        key={`${idea.name}-${idea.style}`}
                        type="button"
                        onClick={() => useNameIdea(idea.name)}
                        className={cn(
                          'rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                          brandIdentity.companyName === idea.name && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black tracking-tight">{idea.name}</p>
                            <p className="text-xs text-primary">{idea.style}</p>
                          </div>
                          {brandIdentity.companyName === idea.name && <Check className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{idea.reason}</p>
                        {idea.caution && (
                          <p className="mt-2 text-xs text-amber-700">Sprawdź: {idea.caution}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Nazwy generuje model AI na podstawie briefu. Przed użyciem produkcyjnym sprawdź domenę, social media i dostępność znaku towarowego.
                </p>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div>
                  <p className="font-semibold">Archetyp marki</p>
                  <p className="text-sm text-muted-foreground">
                    Wybierz charakter marki. To ustawi ton komunikacji i kierunek promptów dla logo, wizytówki, brandbooka i reklam.
                  </p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {brandArchetypes.map((archetype) => {
                    const selected = selectedArchetypeId === archetype.id;
                    return (
                      <button
                        key={archetype.id}
                        type="button"
                        onClick={() => setSelectedArchetypeId(archetype.id)}
                        className={cn(
                          'rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                          selected && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{archetype.title}</p>
                            <p className="text-sm text-primary">{archetype.subtitle}</p>
                          </div>
                          {selected && <Check className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Najlepszy dla: {archetype.bestFor}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Ton: {archetype.tone}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">Generator sloganu / claimu</p>
                    <p className="text-sm text-muted-foreground">
                      Claim może trafić pod logo, na wizytówkę, ofertę i grafiki reklamowe. Krótkie hasło pomaga modelowi utrzymać jeden przekaz.
                    </p>
                  </div>
                  <Button type="button" className="gradient-bg shrink-0" onClick={generateSlogans}>
                    Wygeneruj slogany
                  </Button>
                </div>
                {selectedSlogan && (
                  <div className="mt-3 rounded-xl border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wybrany claim</p>
                    <p className="mt-1 text-lg font-bold">{selectedSlogan}</p>
                  </div>
                )}
                {sloganIdeas.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {sloganIdeas.map((idea) => (
                      <button
                        key={`${idea.text}-${idea.style}`}
                        type="button"
                        onClick={() => useSloganIdea(idea.text)}
                        className={cn(
                          'rounded-xl border bg-background p-4 text-left transition hover:border-primary hover:shadow-sm',
                          selectedSlogan === idea.text && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold leading-tight">{idea.text}</p>
                            <p className="mt-1 text-xs text-primary">{idea.style}</p>
                          </div>
                          {selectedSlogan === idea.text && <Check className="h-5 w-5 text-primary" />}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Użycie: {idea.useCase}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Czy masz już logo?</p>
                <div className="flex flex-wrap gap-2">
                  {logoStatusOptions.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={brandIdentity.logoStatus === option ? 'default' : 'outline'}
                      className={brandIdentity.logoStatus === option ? 'gradient-bg' : ''}
                      onClick={() => setBrandIdentity((current) => ({ ...current, logoStatus: option }))}
                    >
                      {brandIdentity.logoStatus === option && <Check className="mr-1 h-4 w-4" />}
                      {option}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Jaki styl logo pasuje? Możesz wybrać kilka.</p>
                <div className="flex flex-wrap gap-2">
                  {logoStyleOptions.map((option) => {
                    const selected = brandIdentity.logoStyle.includes(option);
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        className={selected ? 'gradient-bg' : ''}
                        onClick={() => toggleBrandChoice('logoStyle', option)}
                      >
                        {selected && <Check className="mr-1 h-4 w-4" />}
                        {option}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Jaki klimat ma mieć marka? Możesz wybrać kilka.</p>
                <div className="flex flex-wrap gap-2">
                  {brandMoodOptions.map((option) => {
                    const selected = brandIdentity.brandMood.includes(option);
                    return (
                      <Button
                        key={option}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        className={selected ? 'gradient-bg' : ''}
                        onClick={() => toggleBrandChoice('brandMood', option)}
                      >
                        {selected && <Check className="mr-1 h-4 w-4" />}
                        {option}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dodatkowe wskazówki do logo / identyfikacji</label>
                <Textarea
                  value={brandIdentity.logoNotes}
                  onChange={(event) => setBrandIdentity((current) => ({ ...current, logoNotes: event.target.value }))}
                  placeholder="np. bez maskotki, prosty znak do użycia na wizytówce, wersja jasna i ciemna, inspiracja premium/tech..."
                />
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                Nazwa jest wymagana przed generowaniem logo, wizytówki i brandbooka. Jeśli jej nie masz, kliknij „Nie mam nazwy — wygeneruj”, wybierz najlepszą propozycję i dopiero przejdź dalej.
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button className="gradient-bg" onClick={goToContact}>Dalej do kontaktu</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'contact' && (
          <Card>
            <CardHeader>
              <CardTitle>Dane kontaktowe</CardTitle>
              <p className="text-sm text-muted-foreground">Jeden ekran kontaktu. Puste pola zostaną pominięte w materiałach.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Imię i nazwisko na wizytówce" value={contact.contactPerson} onChange={(event) => setContact((current) => ({ ...current, contactPerson: event.target.value }))} />
              <Input placeholder="Stanowisko / rola, np. Właściciel" value={contact.jobTitle} onChange={(event) => setContact((current) => ({ ...current, jobTitle: event.target.value }))} />
              <Input placeholder="Telefon" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} />
              <Input placeholder="E-mail" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} />
              <Input placeholder="WWW" value={contact.website} onChange={(event) => setContact((current) => ({ ...current, website: event.target.value }))} />
              <Input placeholder="Instagram" value={contact.instagram} onChange={(event) => setContact((current) => ({ ...current, instagram: event.target.value }))} />
              <div className="sm:col-span-2 flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button className="gradient-bg" onClick={goToStyles}>Dalej do stylu</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'styles' && (
          <Card>
            <CardHeader>
              <CardTitle>Wybierz kierunek wizualny</CardTitle>
              <p className="text-sm text-muted-foreground">
                To nie jest tylko kolor. Ten wybór ustawia klimat logo, wizytówki, brandbooka, postów i promptów.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <p className="text-sm font-semibold">Rekomendacje dla Twojego briefu</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Branża: <span className="font-medium text-foreground">{profile.industry || analysis?.detectedIndustry || 'do doprecyzowania'}</span>
                      {' · '}Klimat: <span className="font-medium text-foreground">{profile.brandMood || 'jeszcze nie wybrano'}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:justify-end">
                    {(['all', 'premium', 'minimal', 'bold', 'local', 'tech'] as const).map((filter) => (
                      <Button
                        key={filter}
                        type="button"
                        size="sm"
                        variant={styleFilter === filter ? 'default' : 'outline'}
                        className={styleFilter === filter ? 'gradient-bg' : ''}
                        onClick={() => setStyleFilter(filter)}
                      >
                        {{
                          all: 'Wszystkie',
                          premium: 'Premium',
                          minimal: 'Minimal',
                          bold: 'Odważne',
                          local: 'Lokalne',
                          tech: 'Tech',
                        }[filter]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {styleRecommendations.map((recommendation) => (
                  <StyleCard
                    key={recommendation.themeId}
                    recommendation={recommendation}
                    selected={selectedThemeId === recommendation.themeId}
                    onSelect={() => setSelectedThemeId(recommendation.themeId)}
                    profile={profile}
                    customColors={customColors}
                  />
                ))}
              </div>

              <div className="rounded-2xl border p-4">
                <p className="font-semibold">Wybrany styl: {getTheme(selectedThemeId).title}</p>
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <BrandStylePreview themeId={selectedThemeId} customColors={customColors} profile={profile} />
                  <div className="space-y-3">
                    <StyleDetails themeId={selectedThemeId} />
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <p className="font-medium">Jak AI użyje tego stylu?</p>
                      <p className="mt-1 text-muted-foreground">
                        Prompty dostaną instrukcję o palecie, klimacie fontu, układzie i rzeczach do unikania. Dzięki temu wizytówka, logo i brandbook powinny iść w jednym kierunku.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button variant="ghost" className="gap-1" onClick={() => setShowAllStyles((value) => !value)}>
                <ChevronDown className="h-4 w-4" /> Pokaż wszystkie style
              </Button>
              {showAllStyles && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {visualThemes
                    .filter((theme) => {
                      if (styleFilter === 'all') return true;
                      const meta = getStyleMeta(theme.id);
                      const haystack = `${theme.title} ${theme.description} ${meta.tags.join(' ')} ${meta.bestFor.join(' ')}`.toLowerCase();
                      if (styleFilter === 'premium') return meta.premium >= 4 || haystack.includes('premium');
                      if (styleFilter === 'minimal') return haystack.includes('minimal') || haystack.includes('czysto');
                      if (styleFilter === 'bold') return meta.energy >= 4 || haystack.includes('odważ');
                      if (styleFilter === 'local') return haystack.includes('lokal') || haystack.includes('rzemie');
                      if (styleFilter === 'tech') return haystack.includes('tech') || haystack.includes('ai') || haystack.includes('automaty');
                      return true;
                    })
                    .map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setSelectedThemeId(theme.id)}
                      className={cn('rounded-xl border p-4 text-left transition hover:border-primary/70 hover:bg-primary/5', selectedThemeId === theme.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border')}
                    >
                      <Swatches colors={theme.colors} />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <p className="font-semibold">{theme.title}</p>
                        {selectedThemeId === theme.id && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{theme.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {getStyleMeta(theme.id).tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="font-semibold">Własne kolory</p>
                <p className="mb-2 text-sm text-muted-foreground">Tekst lub HEX. Nadpisują kolory presetu.</p>
                <Input value={customColors} onChange={(event) => setCustomColors(event.target.value)} placeholder="#111111, #c1121f, #f8f9fa albo czarny, czerwony, srebrny" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ['Premium dark', '#0b0b0f, #f8fafc, #d4af37, #64748b'],
                    ['Tech blue', '#08111f, #f8fbff, #38bdf8, #8b5cf6'],
                    ['Beauty champagne', '#3f2a2d, #fff7f2, #e7c8a0, #b76e79'],
                    ['Local clean', '#1f2937, #ffffff, #10b981, #e5e7eb'],
                  ].map(([label, colors]) => (
                    <Button key={label} type="button" size="sm" variant="outline" onClick={() => setCustomColors(colors)}>
                      {label}
                    </Button>
                  ))}
                  {customColors && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCustomColors('')}>
                      Wyczyść własne kolory
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button
                  className="gradient-bg"
                  onClick={() => {
                    setProfile((current) => enrichBrandBrief(current, selectedThemeId, customColors));
                    setStep('mirror');
                  }}
                >
                  Dalej do briefu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'mirror' && (
          <Card>
            <CardHeader>
              <CardTitle>Tak rozumiem Twoją markę</CardTitle>
              <p className="text-sm text-muted-foreground">To jest źródło prawdy dla promptów. Edytuj przed generowaniem.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const quality = buildLocalBriefQuality(profile, analysis);
                const toneClass =
                  quality.level === 'strong'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : quality.level === 'medium'
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-red-300 bg-red-50 text-red-950';
                return (
                  <div className={cn('rounded-2xl border p-4', toneClass)}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="sm:w-56">
                        <p className="text-sm font-semibold uppercase tracking-wide">Jakość briefu</p>
                        <p className="mt-1 text-2xl font-bold">{quality.score}%</p>
                        <p className="text-sm opacity-80">
                          {quality.level === 'strong'
                            ? 'Brief jest mocny — prompty powinny być konkretne.'
                            : quality.level === 'medium'
                              ? 'Brief jest użyteczny, ale kilka doprecyzowań poprawi wyniki.'
                              : 'Brief jest za ogólny — AI będzie musiało zbyt dużo zgadywać.'}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 text-sm">
                        {quality.conflicts.length > 0 && (
                          <div className="rounded-xl bg-white/60 p-3">
                            <p className="font-semibold">Konflikty do sprawdzenia</p>
                            {quality.conflicts.map((item) => <p key={item}>• {item}</p>)}
                          </div>
                        )}
                        {quality.gaps.length > 0 && (
                          <div className="rounded-xl bg-white/60 p-3">
                            <p className="font-semibold">Najważniejsze braki</p>
                            {quality.gaps.slice(0, 4).map((item) => <p key={item}>• {item}</p>)}
                          </div>
                        )}
                        {quality.suggestions.length > 0 && (
                          <div className="rounded-xl bg-white/60 p-3">
                            <p className="font-semibold">Podpowiedzi przed generowaniem</p>
                            {quality.suggestions.slice(0, 4).map((item) => <p key={item}>• {item}</p>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {briefSections.map((section) => (
                <div key={section.title} className="space-y-3 rounded-2xl border bg-muted/10 p-4">
                  <div>
                    <h3 className="font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <div className="space-y-2">
                    {section.fields.map(([key, label]) => (
                      <div key={key} className="grid grid-cols-1 gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[220px_1fr] sm:items-center">
                        <label className="text-sm font-medium">{label}</label>
                        <Input
                          value={profile[key] || ''}
                          onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                          placeholder="(nie podano — pominę w materiałach)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {false && mirrorFields.map(([key, label]) => (
                <div key={key} className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[220px_1fr] sm:items-center">
                  <label className="text-sm font-medium">{label}</label>
                  <Input
                    value={profile[key] || ''}
                    onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                    placeholder="(nie podano — pominę w materiałach)"
                  />
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[220px_1fr] sm:items-center">
                <label className="text-sm font-medium">Styl wizualny + kolory</label>
                <Input value={`${getTheme(selectedThemeId).title}${customColors ? ` / ${customColors}` : ''}`} readOnly />
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button variant="outline" className="gap-1.5" onClick={() => downloadBrandbookPdf()}>
                  <Download className="h-4 w-4" /> Pobierz brandbook PDF
                </Button>
                <Button className="gradient-bg" onClick={confirmMirror}>Zgadza się, pokaż materiały</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'materials' && (
          <Card>
            <CardHeader>
              <CardTitle>Wybierz materiały</CardTitle>
              <p className="text-sm text-muted-foreground">Rekomendowane przez analizę są oznaczone jako polecane.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">Szacowany koszt pakietu</p>
                    <p className="text-sm text-muted-foreground">Dokładny koszt zależy od modelu wybranego w generatorze.</p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-4 py-2 font-semibold text-primary">
                    ok. {estimatedSelectedMaterialsCost} kredytów
                  </div>
                </div>
              </div>
              {materials.map((material) => {
                const selected = selectedMaterialIds.includes(material.id);
                const recommended = analysis?.recommendedMaterials.includes(material.id);
                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => setSelectedMaterialIds((current) => selected ? current.filter((id) => id !== material.id) : [...current, material.id])}
                    className={cn('w-full rounded-xl border p-4 text-left transition', selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{material.title}</p>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{formatLabels[material.format] || material.format}</span>
                          {recommended && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Polecane dla Ciebie</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{material.description}</p>
                      </div>
                      {selected && <Check className="h-5 w-5 text-primary" />}
                    </div>
                  </button>
                );
              })}
              {selectedMaterialIds.includes('logo-concept') && (
                <div className="rounded-2xl border bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">Logo ma dodatkowy wybór stylu przed promptem</p>
                      <p className="text-sm text-muted-foreground">
                        Aktualnie: {profile.logoPromptStyleTitle || getLogoPromptStyle(selectedLogoPromptStyle).title}. Możesz wymusić konkretny typ logo, np. wordmark, monogram albo znak + nazwa.
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setStep('logo')}>
                      {profile.logoPromptStyleId ? 'Zmień styl logo' : 'Wybierz styl logo'}
                    </Button>
                  </div>
                </div>
              )}
              {selectedMaterials.some((material) => getMaterialVariants(material.id).length > 0) && (
                <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                  <div>
                    <p className="font-semibold">Dopasuj układ wybranych materiałów</p>
                    <p className="text-sm text-muted-foreground">
                      Każdy materiał dostanie osobny kierunek produkcyjny. Możesz np. zrobić wizytówkę typograficzną, a post ekspercki.
                    </p>
                  </div>
                  {selectedMaterials.filter((material) => getMaterialVariants(material.id).length > 0).map((material) => {
                    const variants = getMaterialVariants(material.id);
                    const activeVariantId = selectedMaterialVariants[material.id] || variants[0]?.id;
                    return (
                      <div key={`${material.id}-variants`} className="rounded-xl border bg-background p-3">
                        <p className="text-sm font-semibold">{material.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {variants.map((variant) => {
                            const selected = activeVariantId === variant.id;
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                title={variant.description}
                                onClick={() => {
                                  setSelectedMaterialVariants((current) => ({ ...current, [material.id]: variant.id }));
                                  setProfile((current) => ({ ...current, [`${material.id}VariantId`]: variant.id }));
                                }}
                                className={cn(
                                  'rounded-full border px-3 py-2 text-left text-xs transition hover:border-primary',
                                  selected ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20' : 'bg-background text-muted-foreground',
                                )}
                              >
                                {variant.title}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {getMaterialVariant(material.id, activeVariantId)?.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button className="gradient-bg" disabled={selectedMaterialIds.length === 0} onClick={() => buildPrompts()}>Pokaż prompty</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'logo' && (
          <Card>
            <CardHeader>
              <CardTitle>Wybierz styl logo przed promptem</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ten wybór trafi bezpośrednio do promptu logo. Dzięki temu AI ma wygenerować jedną konkretną wersję, a nie planszę z wariantami.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {logoPromptStyles.map((style) => {
                  const selected = selectedLogoPromptStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedLogoPromptStyle(style.id)}
                      className={cn(
                        'rounded-2xl border bg-background p-4 text-left transition hover:shadow-md',
                        selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{style.title}</p>
                          <p className="text-sm text-primary">{style.subtitle}</p>
                        </div>
                        {selected && <Check className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="mt-4 flex min-h-[72px] items-center justify-center rounded-xl border bg-muted/30 px-4 text-center text-xl font-black tracking-tight">
                        {style.preview}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">Najlepsze do: {style.bestFor}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Unikać: {style.avoid}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="font-semibold">Tekst w logo</p>
                <p className="text-sm text-muted-foreground">Wybierz, czy model ma użyć nazwy firmy, samego znaku czy inicjałów.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ['company-name', 'Dokładna nazwa firmy', 'Najbezpieczniejsze do większości firm'],
                    ['symbol-only', 'Sam znak bez tekstu', 'Dobre, gdy tekst chcesz dodać później w edytorze'],
                    ['monogram', 'Monogram / inicjały', 'Dobre dla krótkich nazw i marek premium'],
                  ].map(([id, label, helper]) => {
                    const selected = logoTextMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLogoTextMode(id as LogoTextMode)}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left transition',
                          selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-background',
                        )}
                      >
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs text-muted-foreground">{helper}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Dodatkowe uwagi do logo</Label>
                <Textarea
                  value={logoPromptNotes}
                  onChange={(event) => setLogoPromptNotes(event.target.value)}
                  placeholder="np. bez ikon mózgu, bardziej premium, prosta błyskawica, nie używaj wielu kolorów"
                  className="mt-1 min-h-[90px]"
                />
              </div>

              <div className="rounded-2xl border bg-background p-4 text-sm">
                <p className="font-semibold">Podgląd decyzji do promptu</p>
                <p className="mt-2 text-muted-foreground">
                  Logo: <span className="font-medium text-foreground">{getLogoPromptStyle(selectedLogoPromptStyle).title}</span> · tekst:{' '}
                  <span className="font-medium text-foreground">
                    {logoTextMode === 'company-name' ? 'dokładna nazwa firmy' : logoTextMode === 'symbol-only' ? 'sam znak bez tekstu' : 'monogram / inicjały'}
                  </span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {getLogoPromptStyle(selectedLogoPromptStyle).promptInstruction}
                </p>
              </div>

              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={goBack}>Wstecz</Button>
                <Button className="gradient-bg" onClick={confirmLogoPromptStyle}>Zatwierdź styl logo i pokaż prompty</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'prompts' && (
          <div className="space-y-4">
            {promptWarnings.length > 0 && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="pt-6 text-sm text-amber-900">
                  {promptWarnings.map((warning) => <p key={warning}>• {warning}</p>)}
                </CardContent>
              </Card>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="gradient-bg gap-1.5" onClick={savePromptPackage}><Save className="h-4 w-4" /> Zapisz pakiet</Button>
              <Button variant="outline" onClick={() => loadCompanyPanel(sessionId)}>Odśwież panel</Button>
              <Button variant="outline" onClick={() => setStep('mirror')}>Wróć do briefu</Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brief firmowy użyty do promptów</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ten brief jest źródłem prawdy dla materiałów. Jeśli coś się nie zgadza, wróć do briefu i popraw pola.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ['Branża', approvedBrief.industry],
                  ['Pozycjonowanie', approvedBrief.positioning],
                  ['Klient', approvedBrief.targetAudience],
                  ['Problem klienta', approvedBrief.customerProblem],
                  ['Oferta', approvedBrief.offer || approvedBrief.specialization],
                  ['Wyróżnik', approvedBrief.differentiator],
                  ['Komunikat', approvedBrief.mainMessage],
                  ['CTA', approvedBrief.cta],
                  ['Styl', approvedBrief.visualDirection],
                  ['Layout', approvedBrief.layoutRules],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm">{value || 'Nie podano'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bieżący pakiet i materiały firmowe</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pokazuję tylko pakiet zapisany z tej rozmowy, żeby nie mieszać go ze starszymi firmami.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentSessionPackages.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Ten projekt nie jest jeszcze zapisany. Kliknij „Zapisz pakiet”, żeby pojawił się w profilu.
                  </div>
                ) : (
                  currentSessionPackages.map((pack) => {
                    const packAssets = companyAssets.filter((asset) => asset.packageId === pack.id || asset.sessionId === pack.profile.sessionId);
                    return (
                      <div key={pack.id} className="rounded-xl border p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold">{pack.companyName || 'Projekt bez nazwy'}</p>
                            <p className="text-sm text-muted-foreground">
                              {pack.industry || 'Branża nieuzupełniona'} · {pack.prompts.length} promptów · {packAssets.length} assetów
                            </p>
                          </div>
                        </div>
                        {packAssets.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {packAssets.slice(0, 6).map((asset) => (
                              <span key={asset.id} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                {asset.assetType === 'logo' ? 'Logo' : asset.materialTitle || asset.materialId}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
            {materialPrompts.map((item) => (
              <Card key={item.materialId}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={item.prompt} readOnly className="min-h-[220px] text-xs leading-relaxed" />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button variant="outline" className="gap-1.5" onClick={() => copyPrompt(item.prompt)}><Copy className="h-4 w-4" /> Kopiuj</Button>
                    <Button className="gradient-bg gap-1.5" onClick={() => usePromptInGenerator(item)}><Wand2 className="h-4 w-4" /> Przejdź do generatora</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </>
        )}
      </motion.div>
    </AppLayout>
  );
};

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex gap-1">
      {colors.slice(0, 5).map((color) => (
        <span key={color} className="h-5 w-9 rounded-full border" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function StyleCard({
  recommendation,
  selected,
  onSelect,
  profile,
  customColors,
}: {
  recommendation: StyleRecommendation;
  selected: boolean;
  onSelect: () => void;
  profile: Record<string, string>;
  customColors: string;
}) {
  const theme = getTheme(recommendation.themeId);
  const colors = previewColors(recommendation.themeId, customColors);
  const meta = getStyleMeta(recommendation.themeId);
  const name = profile.companyName || 'Nazwa marki';
  const headline = profile.offer || profile.specialization || 'Oferta premium';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'NM';
  const bg = colors[1] || '#ffffff';
  const ink = colors[0] || '#111827';
  const accent = colors[2] || '#ec4899';
  const muted = colors[3] || '#e5e7eb';

  return (
    <button type="button" onClick={onSelect} className={cn('rounded-xl border p-4 text-left transition hover:shadow-md', selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border')}>
      <Swatches colors={colors} />
      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="font-semibold">{theme.title}</p>
        {selected && <Check className="h-4 w-4 text-primary" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {meta.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-primary">Font: {recommendation.fontMood} · {meta.fontPair}</p>

      <div className="mt-3 space-y-3 rounded-xl border bg-background p-3">
        <div className="rounded-lg border p-3" style={{ background: bg, color: ink }}>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide opacity-60">Przykład logo</p>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${ink}, ${accent})` }}>
              {initials}
            </span>
            <span className="text-sm font-black tracking-tight">{name}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-h-[96px] rounded-lg border p-3 shadow-sm" style={{ background: ink, color: bg }}>
            <p className="text-[9px] uppercase tracking-wide opacity-70">Wizytówka front</p>
            <div className="mt-5 h-1.5 w-10 rounded-full" style={{ background: accent }} />
            <p className="mt-2 text-xs font-bold leading-tight">{name}</p>
            <p className="mt-1 text-[9px] leading-tight opacity-75">{headline}</p>
          </div>
          <div className="min-h-[96px] rounded-lg border p-3 shadow-sm" style={{ background: bg, color: ink }}>
            <p className="text-[9px] uppercase tracking-wide opacity-60">Wizytówka tył</p>
            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-20 rounded-full" style={{ background: ink }} />
              <div className="h-1.5 w-16 rounded-full" style={{ background: muted }} />
              <div className="h-1.5 w-14 rounded-full" style={{ background: muted }} />
            </div>
            <span className="mt-4 inline-block rounded-full px-2 py-1 text-[9px] font-semibold text-white" style={{ background: accent }}>
              {profile.cta || 'Kontakt'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span>{value}/5</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full gradient-bg" style={{ width: `${Math.min(100, Math.max(0, value * 20))}%` }} />
      </div>
    </div>
  );
}

function StyleDetails({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId);
  const meta = getStyleMeta(themeId);
  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <div>
        <p className="text-sm font-semibold">Charakter stylu</p>
        <p className="mt-1 text-sm text-muted-foreground">{meta.personality}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Meter label="Premium" value={meta.premium} />
        <Meter label="Energia" value={meta.energy} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Najlepszy do</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meta.bestFor.map((item) => (
            <span key={item} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium">Układ</p>
          <p className="text-muted-foreground">{meta.layoutHint}</p>
        </div>
        <div>
          <p className="font-medium">Unikać</p>
          <p className="text-muted-foreground">{meta.avoid}</p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Preset: <span className="font-medium text-foreground">{theme.title}</span> · klimat fontu: <span className="font-medium text-foreground">{theme.fontMood}</span>
      </div>
    </div>
  );
}

function BrandStylePreview({
  themeId,
  customColors,
  profile,
}: {
  themeId: string;
  customColors: string;
  profile: Record<string, string>;
}) {
  const colors = previewColors(themeId, customColors);
  const theme = getTheme(themeId);
  const name = profile.companyName || 'Nazwa marki';
  const offer = profile.offer || profile.specialization || 'Główna oferta';
  const cta = profile.cta || 'Sprawdź ofertę';
  const bg = colors[1] || '#ffffff';
  const ink = colors[0] || '#111827';
  const accent = colors[2] || '#ec4899';
  const muted = colors[3] || '#e5e7eb';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'NM';

  return (
    <div className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Mini podgląd materiałów</p>
          <p className="text-xs text-muted-foreground">{theme.title}</p>
        </div>
        <Swatches colors={colors} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: bg, color: ink }}>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Logo</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black text-white" style={{ background: `linear-gradient(135deg, ${ink}, ${accent})` }}>
              {initials}
            </span>
            <div>
              <p className="text-base font-black leading-tight">{name}</p>
              <p className="text-[11px] opacity-70">{offer}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: ink, color: bg }}>
          <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Post / baner</p>
          <div className="mt-4 h-1.5 w-14 rounded-full" style={{ background: accent }} />
          <p className="mt-3 text-lg font-black leading-tight">{offer}</p>
          <p className="mt-2 text-[11px] opacity-75">{profile.differentiator || 'Konkretny wyróżnik marki w jednym zdaniu.'}</p>
          <span className="mt-4 inline-block rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: accent, color: '#ffffff' }}>
            {cta}
          </span>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm sm:col-span-2" style={{ background: `linear-gradient(135deg, ${bg}, ${muted})`, color: ink }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">Wizytówka</p>
              <p className="mt-2 text-sm font-bold">{name}</p>
              <p className="text-[11px] opacity-70">{profile.phone || profile.email || profile.website || 'kontakt zostanie pominięty, jeśli nie podano'}</p>
            </div>
            <div className="h-12 w-20 rounded-xl" style={{ background: `linear-gradient(135deg, ${ink}, ${accent})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyAssistantV2;
