import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  Copy,
  FileText,
  IdCard,
  Instagram,
  Megaphone,
  Save,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { vpsFetch } from '@/lib/vpsApi';

const PROFILE_STORAGE_KEY = 'companyAssistantProfile';
const SAVED_PACKAGES_STORAGE_KEY = 'companyAssistantSavedPackages';

type StageId = 'existing' | 'starting' | 'idea' | 'exploring';

type CompanyProfile = {
  businessStage: StageId | '';
  visualTheme: string;
  customArea: string;
  companyName: string;
  industry: string;
  nicheInterests: string;
  skills: string;
  startBudget: string;
  timeAvailable: string;
  preferredBusinessModel: string;
  marketPreference: string;
  nicheIdeas: string;
  businessIdea: string;
  hasVisualIdentity: string;
  visualInspiration: string;
  slogan: string;
  offer: string;
  mainProduct: string;
  uniqueValue: string;
  audience: string;
  customerProblem: string;
  city: string;
  address: string;
  website: string;
  instagram: string;
  phone: string;
  email: string;
  brandStyle: string;
  colors: string;
  logoIdea: string;
  tone: string;
  callToAction: string;
  printNotes: string;
  avoid: string;
  extra: string;
};

type ProfileQuestion = {
  key: keyof CompanyProfile;
  title: string;
  helper: string;
  placeholder: string;
  multiline?: boolean;
};

type MaterialTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  format: string;
  style: string;
  icon: typeof IdCard;
  promptGoal: string;
  sections: string[];
};

type PackagePreset = {
  id: string;
  title: string;
  description: string;
  bestFor: string;
  stageIds: StageId[];
  areaId: string;
  visualTheme: string;
  materialIds: string[];
  profilePatch: Partial<CompanyProfile>;
};

type SavedMaterialPrompt = {
  materialId: string;
  title: string;
  format: string;
  style: string;
  prompt: string;
};

type SavedPackage = {
  id: string;
  createdAt: string;
  companyName: string;
  industry: string;
  prompts: SavedMaterialPrompt[];
};

type CompanyAssistantPackagesResponse = {
  ok: boolean;
  packages: SavedPackage[];
};

type SaveCompanyAssistantPackageResponse = {
  ok: boolean;
  package: SavedPackage;
};

const emptyProfile: CompanyProfile = {
  businessStage: '',
  visualTheme: '',
  customArea: '',
  companyName: '',
  industry: '',
  nicheInterests: '',
  skills: '',
  startBudget: '',
  timeAvailable: '',
  preferredBusinessModel: '',
  marketPreference: '',
  nicheIdeas: '',
  businessIdea: '',
  hasVisualIdentity: '',
  visualInspiration: '',
  slogan: '',
  offer: '',
  mainProduct: '',
  uniqueValue: '',
  audience: '',
  customerProblem: '',
  city: '',
  address: '',
  website: '',
  instagram: '',
  phone: '',
  email: '',
  brandStyle: '',
  colors: '',
  logoIdea: '',
  tone: '',
  callToAction: '',
  printNotes: '',
  avoid: '',
  extra: '',
};

const businessStages: Array<{
  id: StageId;
  title: string;
  description: string;
  outcome: string;
}> = [
  {
    id: 'existing',
    title: 'Mam już firmę',
    description: 'Masz nazwę, ofertę lub klientów i chcesz uporządkować materiały.',
    outcome: 'Dostaniesz prompty do konkretnych materiałów dla istniejącej marki.',
  },
  {
    id: 'starting',
    title: 'Dopiero zakładam',
    description: 'Startujesz firmę i chcesz zbudować pierwszy profesjonalny wizerunek.',
    outcome: 'Dostaniesz fundament marki: styl, oferta, klient, brandbook i materiały startowe.',
  },
  {
    id: 'idea',
    title: 'Mam tylko pomysł',
    description: 'Nie musisz mieć nazwy ani firmy — wystarczy kierunek lub luźna idea.',
    outcome: 'Dostaniesz wizualizację pomysłu, propozycję komunikacji i materiały testowe.',
  },
  {
    id: 'exploring',
    title: 'Szukam niszy',
    description: 'Nie masz jeszcze pomysłu i chcesz znaleźć atrakcyjny kierunek.',
    outcome: 'Dostaniesz mapę nisz, kierunki biznesowe i wizualizacje konceptów.',
  },
];

const areaOptions = [
  {
    id: 'local-business',
    title: 'Firma lokalna',
    description: 'Beauty, zdrowie, gastronomia, remonty, usługi premium, lokalna sprzedaż.',
    icon: Store,
  },
  {
    id: 'hairdresser',
    title: 'Fryzjerstwo / barber',
    description: 'Salony fryzjerskie, barber, stylizacja, usługi lokalne.',
    icon: Store,
  },
  {
    id: 'tattoo',
    title: 'Studio tatuażu',
    description: 'Tatuaże, piercing, artyści, portfolio, zapisy i marka studia.',
    icon: Sparkles,
  },
  {
    id: 'beauty',
    title: 'Beauty / kosmetologia',
    description: 'Kosmetologia, medycyna estetyczna, paznokcie, makijaż, spa.',
    icon: Sparkles,
  },
  {
    id: 'gastronomy',
    title: 'Gastronomia',
    description: 'Restauracje, kawiarnie, food trucki, catering, lokalne jedzenie.',
    icon: Store,
  },
  {
    id: 'ecommerce',
    title: 'E-commerce',
    description: 'Sklepy internetowe, produkty, oferty, promocje, marki online.',
    icon: Store,
  },
  {
    id: 'social-media',
    title: 'Social media',
    description: 'Posty, karuzele, reklamy, obsługa kanałów, content dla firm.',
    icon: Instagram,
  },
  {
    id: 'real-estate',
    title: 'Nieruchomości',
    description: 'Agenci, inwestorzy, home staging, prezentacje ofert, najem.',
    icon: Building2,
  },
  {
    id: 'sports-media',
    title: 'Sport / magazyn',
    description: 'Portale, magazyny, newslettery, fanpage, kluby, treści dla kibiców.',
    icon: BookOpen,
  },
  {
    id: 'expert-services',
    title: 'Usługi eksperckie',
    description: 'Doradcy, trenerzy, konsultanci, kancelarie, edukacja, marka osobista.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'other',
    title: 'Inne',
    description: 'Wpisz własną branżę lub pomysł w kolejnym polu.',
    icon: Sparkles,
  },
];

const existingQuestions: ProfileQuestion[] = [
  {
    key: 'companyName',
    title: 'Jak nazywa się firma?',
    helper: 'To będzie nazwa używana na wizytówkach, brandbookach i grafikach.',
    placeholder: 'np. Premium Estates',
  },
  {
    key: 'industry',
    title: 'W jakiej branży działa firma?',
    helper: 'Wpisz konkretnie, np. „nieruchomości premium”, „salon kosmetologii”, „doradztwo finansowe”.',
    placeholder: 'np. nieruchomości premium',
  },
  {
    key: 'offer',
    title: 'Co firma sprzedaje lub oferuje?',
    helper: 'Wypisz główne usługi, produkty albo pakiety.',
    placeholder: 'np. sprzedaż mieszkań premium, wycena, sesja zdjęciowa, home staging',
    multiline: true,
  },
  {
    key: 'mainProduct',
    title: 'Co ma być promowane najmocniej?',
    helper: 'Wybierz jedną główną usługę lub ofertę, żeby materiały nie były chaotyczne.',
    placeholder: 'np. bezpłatna konsultacja sprzedaży mieszkania',
    multiline: true,
  },
  {
    key: 'uniqueValue',
    title: 'Co wyróżnia firmę?',
    helper: 'Doświadczenie, szybkość, jakość, gwarancja, lokalność, efekty, styl obsługi.',
    placeholder: 'np. premium prezentacja ofert, baza inwestorów, pełna obsługa transakcji',
    multiline: true,
  },
  {
    key: 'audience',
    title: 'Kto jest klientem docelowym?',
    helper: 'Opisz klienta, do którego mają trafiać materiały.',
    placeholder: 'np. właściciele mieszkań, inwestorzy, klienci premium',
    multiline: true,
  },
  {
    key: 'customerProblem',
    title: 'Jaki problem klienta rozwiązuje firma?',
    helper: 'To pomoże stworzyć mocniejsze nagłówki i komunikaty sprzedażowe.',
    placeholder: 'np. klient chce sprzedać mieszkanie szybko, ale boi się zaniżonej ceny',
    multiline: true,
  },
  {
    key: 'colors',
    title: 'Jakie kolory ma marka?',
    helper: 'Jeśli nie masz kolorów, wpisz klimat, np. premium, naturalnie, nowocześnie.',
    placeholder: 'np. czerń, biel, złoto',
  },
  {
    key: 'brandStyle',
    title: 'Jaki styl wizualny ma mieć marka?',
    helper: 'Opisz klimat grafik, zdjęć, typografii i układu.',
    placeholder: 'np. minimalistyczny, premium, elegancki, dużo przestrzeni',
    multiline: true,
  },
  {
    key: 'tone',
    title: 'Jakim tonem marka ma mówić?',
    helper: 'Np. ekspercko, prosto, lokalnie, luksusowo, luźno, dynamicznie.',
    placeholder: 'np. ekspercko, konkretnie, premium',
  },
  {
    key: 'callToAction',
    title: 'Jakie wezwanie do działania ma się pojawiać?',
    helper: 'To tekst typu: umów konsultację, napisz do nas, sprawdź ofertę.',
    placeholder: 'np. Umów bezpłatną konsultację',
  },
  {
    key: 'city',
    title: 'Gdzie działa firma?',
    helper: 'Miasto, region, cała Polska albo online.',
    placeholder: 'np. Warszawa / cała Polska / online',
  },
  {
    key: 'phone',
    title: 'Jaki telefon pokazywać na materiałach?',
    helper: 'Opcjonalnie.',
    placeholder: '+48...',
  },
  {
    key: 'email',
    title: 'Jaki e-mail pokazywać na materiałach?',
    helper: 'Opcjonalnie.',
    placeholder: 'kontakt@firma.pl',
  },
  {
    key: 'website',
    title: 'Jaka jest strona www lub profil?',
    helper: 'Opcjonalnie — może być też Instagram, LinkedIn albo landing page.',
    placeholder: 'www.firma.pl / @profil',
  },
  {
    key: 'avoid',
    title: 'Czego unikać w projektach?',
    helper: 'Np. chaosu, małego tekstu, stockowego stylu, krzykliwych kolorów.',
    placeholder: 'np. unikaj jaskrawych kolorów i taniego stockowego wyglądu',
    multiline: true,
  },
];

const startingQuestions: ProfileQuestion[] = [
  {
    key: 'businessIdea',
    title: 'Co chcesz założyć?',
    helper: 'Opisz firmę, którą planujesz — nawet jeśli jeszcze nie masz nazwy.',
    placeholder: 'np. butikowa agencja nieruchomości dla klientów premium',
    multiline: true,
  },
  {
    key: 'industry',
    title: 'Jaka to branża lub nisza?',
    helper: 'Im konkretniej, tym lepszy kierunek marki.',
    placeholder: 'np. nieruchomości premium, kosmetologia, lokalna gastronomia',
  },
  {
    key: 'audience',
    title: 'Kto ma być klientem?',
    helper: 'Opisz, do kogo chcesz sprzedawać.',
    placeholder: 'np. właściciele mieszkań premium, inwestorzy, lokalne firmy',
    multiline: true,
  },
  {
    key: 'customerProblem',
    title: 'Jaki problem klienta chcesz rozwiązać?',
    helper: 'Dobry biznes zaczyna się od konkretnego problemu.',
    placeholder: 'np. właściciele nie wiedzą, jak dobrze zaprezentować i sprzedać mieszkanie',
    multiline: true,
  },
  {
    key: 'offer',
    title: 'Jaka może być pierwsza oferta?',
    helper: 'Może być robocza. AI pomoże ją później uporządkować.',
    placeholder: 'np. konsultacja, analiza, pakiet startowy, obsługa sprzedaży',
    multiline: true,
  },
  {
    key: 'companyName',
    title: 'Czy masz nazwę lub nazwę roboczą?',
    helper: 'Jeśli nie masz nazwy, wpisz „AI ma zaproponować nazwę”.',
    placeholder: 'np. Premium Estates / AI ma zaproponować nazwę',
  },
  {
    key: 'hasVisualIdentity',
    title: 'Czy masz już coś wizualnego?',
    helper: 'Logo, kolory, fonty, inspiracje — albo informacja, że zaczynamy od zera.',
    placeholder: 'np. nie mam nic, chcę propozycję od zera',
  },
  {
    key: 'visualInspiration',
    title: 'Jaką wizualizację marki chcesz zobaczyć?',
    helper: 'Opisz klimat, który ma pokazać AI.',
    placeholder: 'np. premium, białe tło, czarna typografia, złote akcenty',
    multiline: true,
  },
  {
    key: 'colors',
    title: 'Jakie kolory Ci pasują?',
    helper: 'Możesz podać kolory albo zdać się na propozycję AI.',
    placeholder: 'np. czerń, biel, złoto / AI ma dobrać',
  },
  {
    key: 'brandStyle',
    title: 'Jaki styl marki będzie najlepszy?',
    helper: 'Wpisz klimat: premium, lokalny, ekspercki, butikowy, minimalistyczny itd.',
    placeholder: 'np. premium, minimalistyczny, bardzo czytelny',
    multiline: true,
  },
  {
    key: 'callToAction',
    title: 'Co klient ma zrobić po zobaczeniu materiału?',
    helper: 'To będzie domyślne CTA w grafikach.',
    placeholder: 'np. Umów konsultację / Napisz wiadomość / Sprawdź ofertę',
  },
  {
    key: 'extra',
    title: 'Co jeszcze powinien wiedzieć kreator?',
    helper: 'Wpisz ograniczenia, inspiracje, rzeczy obowiązkowe albo zakazane.',
    placeholder: 'np. ma wyglądać drogo, ale bez przepychu',
    multiline: true,
  },
];

const ideaQuestions: ProfileQuestion[] = [
  {
    key: 'businessIdea',
    title: 'Opisz swój pomysł jednym zdaniem',
    helper: 'Nie pytamy jeszcze o nazwę firmy. Najpierw zrozummy sam pomysł.',
    placeholder: 'np. Chcę pomagać agentom nieruchomości tworzyć lepsze prezentacje ofert',
    multiline: true,
  },
  {
    key: 'industry',
    title: 'W jakim obszarze jest ten pomysł?',
    helper: 'Wpisz branżę albo temat, nawet ogólnie.',
    placeholder: 'np. nieruchomości, social media, lokalne usługi, edukacja',
  },
  {
    key: 'audience',
    title: 'Dla kogo to ma być?',
    helper: 'Opisz grupę ludzi lub firm, którym ten pomysł ma pomagać.',
    placeholder: 'np. agenci nieruchomości, właściciele mieszkań, małe firmy',
    multiline: true,
  },
  {
    key: 'customerProblem',
    title: 'Jaki problem ma rozwiązywać ten pomysł?',
    helper: 'To jest ważniejsze niż nazwa. Problem ustawia komunikację i ofertę.',
    placeholder: 'np. oferty mieszkań wyglądają słabo i nie przyciągają dobrych klientów',
    multiline: true,
  },
  {
    key: 'mainProduct',
    title: 'Co klient miałby dostać?',
    helper: 'Usługę, produkt cyfrowy, konsultację, gotowy pakiet, raport, szablony?',
    placeholder: 'np. pakiet grafik i opisów do prezentacji nieruchomości',
    multiline: true,
  },
  {
    key: 'uniqueValue',
    title: 'Dlaczego ktoś miałby wybrać właśnie to?',
    helper: 'Wpisz przewagę albo coś, co może być atrakcyjne.',
    placeholder: 'np. szybciej, ładniej, bardziej premium, z użyciem AI, bez agencji',
    multiline: true,
  },
  {
    key: 'preferredBusinessModel',
    title: 'Jak chcesz na tym zarabiać?',
    helper: 'Jeśli nie wiesz, wybierz podpowiedź.',
    placeholder: 'np. usługa premium, abonament, produkt cyfrowy, konsultacje',
  },
  {
    key: 'visualInspiration',
    title: 'Jaką pierwszą wizualizację chcesz zobaczyć?',
    helper: 'To będzie kierunek dla moodboardu, brandbooka i materiałów.',
    placeholder: 'np. premium, minimalistycznie, styl magazynu biznesowego',
    multiline: true,
  },
  {
    key: 'companyName',
    title: 'Czy masz nazwę roboczą?',
    helper: 'Jeśli nie masz, wpisz „AI ma zaproponować nazwę”.',
    placeholder: 'np. EstateBoost / AI ma zaproponować nazwę',
  },
  {
    key: 'colors',
    title: 'Jakie kolory lub klimat kolorów pasują?',
    helper: 'Możesz wpisać „AI ma dobrać”, jeśli nie wiesz.',
    placeholder: 'np. czarny, biały, złoty / AI ma dobrać',
  },
  {
    key: 'tone',
    title: 'Jak marka ma brzmieć?',
    helper: 'Ekspercko, luźno, premium, prosto, edukacyjnie, dynamicznie?',
    placeholder: 'np. ekspercko, konkretnie, premium',
  },
  {
    key: 'extra',
    title: 'Co jeszcze warto uwzględnić?',
    helper: 'Luźne notatki, inspiracje, ograniczenia, konkurencja, rzeczy do uniknięcia.',
    placeholder: 'np. chcę sprawdzić, czy to wygląda jak realny biznes',
    multiline: true,
  },
];

const exploringQuestions: ProfileQuestion[] = [
  {
    key: 'nicheInterests',
    title: 'Jakie branże, tematy albo rynki Cię interesują?',
    helper: 'Nie musisz mieć firmy. Wpisz obszary, które Cię ciekawią.',
    placeholder: 'np. nieruchomości, inwestowanie, beauty, fitness, gastronomia, lokalne usługi',
    multiline: true,
  },
  {
    key: 'skills',
    title: 'Co umiesz albo w czym masz przewagę?',
    helper: 'Kontakty, doświadczenie, sprzedaż, wiedza, lokalny rynek, marketing, technologia.',
    placeholder: 'np. umiem sprzedawać, znam rynek mieszkań, robię dobre zdjęcia',
    multiline: true,
  },
  {
    key: 'startBudget',
    title: 'Jaki masz budżet na start?',
    helper: 'To pomoże dobrać realne nisze, a nie tylko ładne na papierze.',
    placeholder: 'np. 0-1000 zł / 5000 zł / 20 000 zł / chcę zacząć bez kosztów',
  },
  {
    key: 'timeAvailable',
    title: 'Ile czasu tygodniowo możesz poświęcić?',
    helper: 'Inaczej wygląda nisza poboczna po godzinach, inaczej pełny biznes.',
    placeholder: 'np. 5h tygodniowo / weekendy / pełny etat',
  },
  {
    key: 'preferredBusinessModel',
    title: 'Jaki model biznesowy Cię interesuje?',
    helper: 'Usługa, produkt cyfrowy, lokalny biznes, marka osobista, agencja, e-commerce.',
    placeholder: 'np. usługi premium, produkt cyfrowy, agencja, lokalna firma',
  },
  {
    key: 'marketPreference',
    title: 'Dla kogo chcesz działać?',
    helper: 'To zawęzi pomysły: klienci premium, B2B, początkujący, inwestorzy, lokalni klienci.',
    placeholder: 'np. właściciele mieszkań, inwestorzy, małe firmy, kobiety 30+',
    multiline: true,
  },
  {
    key: 'nicheIdeas',
    title: 'Czy masz luźne pomysły na niszę?',
    helper: 'Wpisz wszystko, nawet chaotycznie. Kreator to uporządkuje.',
    placeholder: 'np. social media dla deweloperów, home staging AI, doradztwo premium',
    multiline: true,
  },
  {
    key: 'customerProblem',
    title: 'Jakie problemy klientów chcesz rozwiązywać?',
    helper: 'Jeśli nie wiesz, użyj podpowiedzi — po to jest ten kreator.',
    placeholder: 'np. brak czasu, słaby marketing, chaos w sprzedaży, trudność w zdobyciu klientów',
    multiline: true,
  },
  {
    key: 'visualInspiration',
    title: 'Jaką wizualizację potencjalnej marki chcesz zobaczyć?',
    helper: 'Opisz klimat. To pomoże stworzyć pierwszą wizualizację niszy.',
    placeholder: 'np. premium, minimalistycznie, czarne logo, białe tło, styl inwestycyjny',
    multiline: true,
  },
  {
    key: 'brandStyle',
    title: 'Jaki styl marki byłby dla Ciebie atrakcyjny?',
    helper: 'To nie jest finalna decyzja — chodzi o pierwszą dobrą wizualizację.',
    placeholder: 'np. premium, butikowo, ekspercko, lokalnie, nowocześnie',
    multiline: true,
  },
];

const questionsByStage: Record<StageId, ProfileQuestion[]> = {
  existing: existingQuestions,
  starting: startingQuestions,
  idea: ideaQuestions,
  exploring: exploringQuestions,
};

const materials: MaterialTemplate[] = [
  {
    id: 'niche-map',
    title: 'Mapa niszy',
    category: 'Strategia',
    description: 'Plansza z 3-5 propozycjami nisz, klientem, ofertą, korzyścią i potencjałem.',
    format: '4:5',
    style: 'illustration',
    icon: Sparkles,
    promptGoal: 'Create a premium niche discovery board for a person looking for a business niche, with clear options and visual direction.',
    sections: ['3-5 niche ideas', 'target customer', 'main problem', 'offer idea', 'why it can work', 'first materials to create'],
  },
  {
    id: 'concept-visualization',
    title: 'Wizualizacja konceptu marki',
    category: 'Marka',
    description: 'Pierwsza wizualizacja potencjalnej marki: klimat, kolory, układ i przykładowe materiały.',
    format: '4:5',
    style: 'illustration',
    icon: BookOpen,
    promptGoal: 'Create a polished first brand concept visualization for a new business idea, showing how the potential brand could look.',
    sections: ['brand moodboard', 'sample logo direction', 'color palette', 'typography direction', 'example post', 'business card preview'],
  },
  {
    id: 'business-card',
    title: 'Wizytówka',
    category: 'Druk',
    description: 'Dwustronna wizytówka z danymi kontaktowymi i charakterem marki.',
    format: '16:9',
    style: 'realistic',
    icon: IdCard,
    promptGoal: 'Create a premium double-sided business card design, print-ready look, clean spacing, elegant typography.',
    sections: ['front side with logo/name', 'back side with contact details', 'brand colors', 'clear hierarchy', 'contact details'],
  },
  {
    id: 'brandbook',
    title: 'Mini brandbook',
    category: 'Marka',
    description: 'Plansza z kolorami, fontami, stylem zdjęć, ikonami i zasadami komunikacji.',
    format: '4:5',
    style: 'illustration',
    icon: BookOpen,
    promptGoal: 'Create a mini brandbook one-page board for a company, premium visual identity presentation.',
    sections: ['logo concept', 'color palette', 'typography suggestions', 'photo style', 'icon style', 'tone of voice', 'do and do not section'],
  },
  {
    id: 'offer-flyer',
    title: 'Ulotka / oferta',
    category: 'Druk',
    description: 'Jednostronicowa oferta usług lub produktu z jasnym CTA.',
    format: '4:5',
    style: 'realistic',
    icon: FileText,
    promptGoal: 'Create a professional one-page flyer / offer sheet for a business, ready for print and digital sharing.',
    sections: ['headline', 'main offer', '3 benefits', 'contact box', 'call to action', 'premium spacing'],
  },
  {
    id: 'instagram-post',
    title: 'Post Instagram',
    category: 'Social media',
    description: 'Gotowy post promujący ofertę lub wyróżnik firmy.',
    format: '4:5',
    style: 'realistic',
    icon: Instagram,
    promptGoal: 'Create a high-converting Instagram 4:5 post for a business, clean commercial design.',
    sections: ['strong hook', 'one clear offer', 'benefit-driven copy', 'brand visual style', 'CTA'],
  },
  {
    id: 'ad-banner',
    title: 'Baner reklamowy',
    category: 'Reklama',
    description: 'Baner do kampanii lub strony z mocnym komunikatem sprzedażowym.',
    format: '16:9',
    style: 'realistic',
    icon: Megaphone,
    promptGoal: 'Create a premium advertising banner for a business campaign, high readability and strong CTA.',
    sections: ['main headline', 'supporting benefit', 'visual hero area', 'CTA button style'],
  },
  {
    id: 'company-starter-pack',
    title: 'Pakiet startowy firmy',
    category: 'Strategia',
    description: 'Jedna plansza z listą materiałów, które firma powinna mieć na start.',
    format: '4:5',
    style: 'illustration',
    icon: Sparkles,
    promptGoal: 'Create a practical starter materials checklist for a business owner, premium infographic style.',
    sections: ['must-have print materials', 'must-have social materials', 'sales assets', 'brand consistency tips'],
  },
];

const materialIdsByStage: Record<StageId, string[]> = {
  existing: ['business-card', 'brandbook', 'offer-flyer', 'instagram-post', 'ad-banner', 'company-starter-pack'],
  starting: ['concept-visualization', 'brandbook', 'company-starter-pack', 'business-card', 'instagram-post', 'offer-flyer'],
  idea: ['concept-visualization', 'brandbook', 'company-starter-pack', 'instagram-post', 'offer-flyer'],
  exploring: ['niche-map', 'concept-visualization', 'brandbook', 'instagram-post', 'company-starter-pack'],
};

const defaultMaterialIdsByStage: Record<StageId, string[]> = {
  existing: ['business-card', 'brandbook'],
  starting: ['concept-visualization', 'brandbook'],
  idea: ['concept-visualization', 'brandbook'],
  exploring: ['niche-map', 'concept-visualization'],
};

const packagePresets: PackagePreset[] = [
  {
    id: 'local-start-pack',
    title: 'Start lokalnej firmy',
    description: 'Wizytówka, mini brandbook, oferta i post otwierający dla usług lokalnych.',
    bestFor: 'salony beauty, usługi, gastronomia, remonty, małe firmy premium',
    stageIds: ['existing', 'starting', 'idea'],
    areaId: 'local-business',
    visualTheme: 'local-friendly',
    materialIds: ['business-card', 'brandbook', 'offer-flyer', 'instagram-post'],
    profilePatch: {
      industry: 'firma lokalna / usługi premium',
      offer: 'lokalna usługa premium z prostą ofertą, jasnym kontaktem i zaufanym wizerunkiem',
      audience: 'lokalni klienci, którzy chcą szybkiej, profesjonalnej i zaufanej obsługi',
      customerProblem: 'klient nie wie, komu zaufać i wybiera firmy, które wyglądają profesjonalnie',
      tone: 'przyjazny, prosty, lokalny, wiarygodny',
      callToAction: 'Umów termin',
      brandStyle: 'ciepły, lokalny, profesjonalny, z dużą czytelnością i naturalnymi kolorami',
    },
  },
  {
    id: 'real-estate-premium-pack',
    title: 'Nieruchomości premium',
    description: 'Brandbook, oferta, post i baner dla agenta, inwestora lub usługi home staging.',
    bestFor: 'agenci, biura nieruchomości, inwestorzy, prezentacje ofert',
    stageIds: ['existing', 'starting', 'idea', 'exploring'],
    areaId: 'real-estate',
    visualTheme: 'luxury-real-estate',
    materialIds: ['concept-visualization', 'brandbook', 'offer-flyer', 'instagram-post', 'ad-banner'],
    profilePatch: {
      industry: 'nieruchomości premium',
      nicheInterests: 'nieruchomości premium, sprzedaż mieszkań, inwestorzy, home staging',
      businessIdea: 'Pomagam lepiej prezentować i sprzedawać nieruchomości dzięki profesjonalnej komunikacji i materiałom premium.',
      offer: 'prezentacja ofert nieruchomości, materiały sprzedażowe, konsultacja, marketing i komunikacja premium',
      audience: 'właściciele mieszkań, agenci nieruchomości, inwestorzy i klienci premium',
      customerProblem: 'oferty wyglądają zbyt przeciętnie i nie budują zaufania ani poczucia wartości',
      uniqueValue: 'premium prezentacja, czysta komunikacja, lepsze pierwsze wrażenie i większa wiarygodność',
      tone: 'premium, konkretny, ekspercki',
      callToAction: 'Umów konsultację',
    },
  },
  {
    id: 'social-manager-pack',
    title: 'Social media manager',
    description: 'Pakiet dla osoby lub agencji tworzącej posty, karuzele, oferty i reklamy.',
    bestFor: 'freelancerzy, agencje, twórcy contentu, obsługa kanałów firmowych',
    stageIds: ['existing', 'starting', 'idea', 'exploring'],
    areaId: 'social-media',
    visualTheme: 'bold-agency',
    materialIds: ['concept-visualization', 'brandbook', 'instagram-post', 'offer-flyer', 'company-starter-pack'],
    profilePatch: {
      industry: 'social media / content marketing',
      nicheInterests: 'social media, karuzele edukacyjne, reklamy, content dla firm',
      businessIdea: 'Tworzę profesjonalne materiały social media dla firm, które chcą wyglądać lepiej i sprzedawać konkretniej.',
      offer: 'prowadzenie profili, grafiki, karuzele, strategia treści, reklamy i pakiety contentowe',
      audience: 'właściciele firm i eksperci, którzy nie mają czasu ani pomysłu na regularną komunikację',
      customerProblem: 'firma publikuje nieregularnie, wygląda chaotycznie i nie ma spójnego przekazu',
      tone: 'dynamiczny, konkretny, nowoczesny, sprzedażowy',
      callToAction: 'Sprawdź pakiet contentowy',
    },
  },
  {
    id: 'sports-magazine-pack',
    title: 'Magazyn / media sportowe',
    description: 'Wizualizacja marki, brandbook, post i baner dla projektu o piłce nożnej lub sporcie.',
    bestFor: 'magazyny piłkarskie, portale sportowe, newslettery, kanały dla kibiców',
    stageIds: ['existing', 'starting', 'idea', 'exploring'],
    areaId: 'sports-media',
    visualTheme: 'bold-agency',
    materialIds: ['concept-visualization', 'brandbook', 'instagram-post', 'ad-banner', 'company-starter-pack'],
    profilePatch: {
      industry: 'piłka nożna / magazyn sportowy',
      nicheInterests: 'piłka nożna, sport, magazyn, newsy, analizy meczowe, kibice',
      businessIdea: 'Tworzę magazyn / projekt medialny o piłce nożnej z profesjonalną identyfikacją i czytelnymi materiałami.',
      offer: 'treści sportowe, newsy, analizy, posty, karuzele, newsletter i materiały dla społeczności kibiców',
      audience: 'kibice piłki nożnej, osoby śledzące ligi, transfery, analizy i ciekawostki sportowe',
      customerProblem: 'odbiorcy chcą szybkich, czytelnych i atrakcyjnie podanych treści sportowych',
      uniqueValue: 'czytelny styl magazynowy, mocne nagłówki, szybkie formaty social media i spójna marka',
      tone: 'dynamiczny, sportowy, konkretny, lekko magazynowy',
      callToAction: 'Obserwuj po więcej analiz',
      brandStyle: 'nowoczesny magazyn sportowy, mocne nagłówki, kontrast, energia stadionu, czytelne layouty',
    },
  },
  {
    id: 'expert-premium-pack',
    title: 'Ekspert / usługi premium',
    description: 'Elegancki pakiet dla doradców, trenerów, kancelarii i marek osobistych.',
    bestFor: 'doradcy, trenerzy, konsultanci, kancelarie, edukacja premium',
    stageIds: ['existing', 'starting', 'idea'],
    areaId: 'expert-services',
    visualTheme: 'premium-black-gold',
    materialIds: ['business-card', 'brandbook', 'offer-flyer', 'instagram-post', 'ad-banner'],
    profilePatch: {
      industry: 'usługi eksperckie premium',
      offer: 'konsultacje, doradztwo, analiza, strategia i indywidualna współpraca',
      audience: 'klienci, którzy chcą eksperckiego wsparcia i są gotowi zapłacić za jakość',
      customerProblem: 'klient ma chaos, brak decyzji albo potrzebuje zaufanego eksperta',
      uniqueValue: 'jasna diagnoza, doświadczenie, konkretne rekomendacje i premium obsługa',
      tone: 'ekspercki, spokojny, konkretny, premium',
      callToAction: 'Umów konsultację',
    },
  },
  {
    id: 'niche-discovery-pack',
    title: 'Szukam niszy',
    description: 'Mapa niszy, wizualizacja konceptu i pierwszy pakiet testowy do walidacji pomysłu.',
    bestFor: 'osoby bez firmy, które chcą znaleźć realny kierunek i szybko go zobaczyć',
    stageIds: ['exploring'],
    areaId: 'real-estate',
    visualTheme: 'minimal-white',
    materialIds: ['niche-map', 'concept-visualization', 'brandbook', 'instagram-post', 'company-starter-pack'],
    profilePatch: {
      nicheInterests: 'nieruchomości, usługi premium, social media, lokalne firmy, edukacja',
      preferredBusinessModel: 'usługa premium albo produkt cyfrowy do szybkiego testu',
      marketPreference: 'małe firmy, eksperci lub właściciele nieruchomości, którzy potrzebują lepszych materiałów',
      customerProblem: 'brak profesjonalnej prezentacji, chaos w komunikacji i słabe pierwsze wrażenie',
      visualInspiration: 'minimalistyczny, premium, bardzo czytelny kierunek marki, który można szybko przetestować',
    },
  },
];

const benefitsByStage: Record<StageId, string[]> = {
  existing: [
    'Porządkujesz istniejącą markę i tworzysz gotowe materiały szybciej.',
    'Dane firmy zapisują się, więc nie musisz wpisywać ich ponownie.',
    'Każdy materiał dostaje osobny prompt i osobne przejście do generatora.',
  ],
  starting: [
    'Układasz fundament marki przed drukiem wizytówek i publikacją postów.',
    'Kreator pomaga dobrać styl, klienta, ofertę i pierwsze CTA.',
    'Na końcu zapisujesz pakiet promptów przypisany do konta.',
  ],
  idea: [
    'Nie potrzebujesz jeszcze nazwy firmy — zaczynamy od sensu pomysłu.',
    'Zamieniasz luźną ideę w wizualizację marki i pierwsze materiały.',
    'Dostajesz prompty do sprawdzenia, czy pomysł wygląda jak realny biznes.',
  ],
  exploring: [
    'Szukasz niszy przez zainteresowania, umiejętności, budżet i czas.',
    'Dostajesz mapę nisz oraz wizualizację potencjalnej marki.',
    'To może być płatny kreator startowy, bo daje gotowy kierunek do testu.',
  ],
};

const visualThemes = [
  {
    id: 'premium-black-gold',
    title: 'Premium Black & Gold',
    description: 'Luksusowy, mocny kontrast, idealny pod nieruchomości premium i usługi eksperckie.',
    colors: ['#111111', '#f7f2e8', '#c9a227'],
    prompt: 'premium black and gold identity, luxury spacing, elegant editorial typography, white and black contrast, subtle gold accents',
  },
  {
    id: 'minimal-white',
    title: 'Minimal White',
    description: 'Czysty, lekki, bardzo czytelny styl do ofert, brandbooków i edukacji.',
    colors: ['#ffffff', '#111827', '#e5e7eb'],
    prompt: 'minimal white brand identity, clean editorial layout, lots of whitespace, black typography, subtle gray dividers',
  },
  {
    id: 'luxury-real-estate',
    title: 'Luxury Real Estate',
    description: 'Elegancki styl dla agentów, inwestorów, ofert mieszkań i marek premium.',
    colors: ['#0f172a', '#ffffff', '#d6b46a'],
    prompt: 'luxury real estate visual identity, elegant interiors feeling, navy black white and muted gold, premium brochure aesthetic',
  },
  {
    id: 'bold-agency',
    title: 'Bold Agency',
    description: 'Odważny, nowoczesny styl pod social media, marketing i kreatywne usługi.',
    colors: ['#111827', '#ec4899', '#38bdf8'],
    prompt: 'bold modern agency identity, strong gradients, high contrast, dynamic typography, social media ready layout',
  },
  {
    id: 'local-friendly',
    title: 'Local Friendly',
    description: 'Ciepły, prosty i zaufany styl dla lokalnych usług i małych firm.',
    colors: ['#fbf7ef', '#2f3e2f', '#d88945'],
    prompt: 'warm local friendly brand identity, natural colors, approachable layout, soft shapes, trustworthy small business aesthetic',
  },
  {
    id: 'clean-medical-beauty',
    title: 'Clean Beauty / Medical',
    description: 'Delikatny, czysty styl dla beauty, zdrowia, kosmetologii i usług premium.',
    colors: ['#ffffff', '#d8b4a0', '#7f8c8d'],
    prompt: 'clean beauty medical premium identity, soft beige accents, elegant minimal typography, calm white background',
  },
  {
    id: 'tattoo-dark-ink',
    title: 'Tattoo Dark Ink',
    description: 'Mroczny, kontrastowy styl dla studia tatuażu, barberów i marek z charakterem.',
    colors: ['#0b0b0f', '#f3efe7', '#8b1e3f', '#c7a76c'],
    prompt: 'dark tattoo studio identity, black ink aesthetic, off-white paper texture feeling, burgundy accents, strong serif and gothic inspired typography, premium alternative brand style',
  },
  {
    id: 'street-neon',
    title: 'Street Neon',
    description: 'Energia miasta, neon, mocny kontrast — dobre dla sportu, muzyki, streetwearu i eventów.',
    colors: ['#111827', '#00f5d4', '#ff2e63', '#faff00'],
    prompt: 'urban street neon brand identity, dark background, cyan magenta yellow accents, energetic composition, bold modern typography, nightlife and street culture aesthetic',
  },
  {
    id: 'sport-stadium',
    title: 'Sport Stadium',
    description: 'Dynamiczna paleta sportowa dla klubów, magazynów, fanpage i wydarzeń.',
    colors: ['#052e16', '#ffffff', '#22c55e', '#facc15'],
    prompt: 'dynamic sports media identity, stadium energy, green field accents, crisp white typography, yellow highlight color, bold editorial sports layout',
  },
  {
    id: 'pastel-beauty',
    title: 'Pastel Beauty',
    description: 'Miękki, kobiecy, estetyczny styl dla beauty, paznokci, makijażu i wellness.',
    colors: ['#4a2c2a', '#fff1f2', '#f9a8d4', '#c4b5fd'],
    prompt: 'soft pastel beauty identity, blush pink lavender and warm brown palette, delicate typography, elegant whitespace, feminine premium wellness look',
  },
  {
    id: 'eco-organic',
    title: 'Eco Organic',
    description: 'Naturalny, spokojny styl dla marek eko, zdrowia, kawiarni i lokalnych produktów.',
    colors: ['#1f3d2b', '#f4efe6', '#a3b18a', '#d4a373'],
    prompt: 'organic eco brand identity, natural greens, warm beige paper feeling, botanical accents, calm trustworthy design, handmade premium aesthetic',
  },
  {
    id: 'tech-blue',
    title: 'Tech Blue',
    description: 'Nowoczesny, chłodny styl dla SaaS, AI, IT, automatyzacji i usług cyfrowych.',
    colors: ['#0f172a', '#eff6ff', '#2563eb', '#38bdf8'],
    prompt: 'modern tech brand identity, deep navy and electric blue palette, clean geometric layout, SaaS aesthetic, precise typography and futuristic light accents',
  },
  {
    id: 'food-warm',
    title: 'Food Warm',
    description: 'Apetyt, ciepło, lokalny klimat — dobre dla gastro, kawiarni, cateringu i food trucków.',
    colors: ['#3b1f14', '#fff7ed', '#f97316', '#facc15'],
    prompt: 'warm food brand identity, appetizing orange yellow and cream palette, friendly restaurant aesthetic, bold menu-style typography, local artisan feeling',
  },
  {
    id: 'kids-playful',
    title: 'Kids Playful',
    description: 'Kolorowy, lekki i przyjazny styl dla dzieci, edukacji, zabawek i rodzinnych usług.',
    colors: ['#1e3a8a', '#fefce8', '#fb7185', '#60a5fa', '#fbbf24'],
    prompt: 'playful family and kids brand identity, colorful friendly palette, rounded shapes, optimistic typography, clean cheerful layout',
  },
  {
    id: 'editorial-magazine',
    title: 'Editorial Magazine',
    description: 'Magazynowy, premium, czytelny styl dla portali, newsletterów i marek eksperckich.',
    colors: ['#111111', '#fafafa', '#dc2626', '#a3a3a3'],
    prompt: 'premium editorial magazine identity, black white red accent palette, strong headlines, grid layout, refined publication design, high readability',
  },
  {
    id: 'creative-gradient',
    title: 'Creative Gradient',
    description: 'Kolorowy, nowoczesny gradient dla agencji, twórców, kursów i marek online.',
    colors: ['#111827', '#f0f9ff', '#a855f7', '#ec4899', '#0ea5e9'],
    prompt: 'creative gradient brand identity, violet pink blue accents, modern creator economy aesthetic, dynamic shapes, bold clean typography',
  },
  {
    id: 'mono-luxury',
    title: 'Mono Luxury',
    description: 'Czerń, biel i szarości — bardzo czysty styl dla marek premium bez krzykliwości.',
    colors: ['#050505', '#ffffff', '#d4d4d8', '#737373'],
    prompt: 'monochrome luxury identity, black white gray palette, ultra minimal composition, expensive whitespace, refined typography, no noisy decoration',
  },
];

function normalizeStage(value: unknown): StageId | '' {
  if (value === 'existing' || value === 'Mam już firmę') return 'existing';
  if (value === 'starting' || value === 'Dopiero zakładam') return 'starting';
  if (value === 'idea' || value === 'Mam tylko pomysł') return 'idea';
  if (value === 'exploring' || value === 'Szukam niszy') return 'exploring';
  return '';
}

function loadProfile(): CompanyProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return emptyProfile;
    const parsed = JSON.parse(raw);

    return {
      ...emptyProfile,
      ...parsed,
      businessStage: normalizeStage(parsed.businessStage),
    };
  } catch {
    return emptyProfile;
  }
}

function loadSavedPackages(): SavedPackage[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PACKAGES_STORAGE_KEY);
    if (!raw) return [];

    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getProfileColorTokens(colors: string) {
  return colors
    .split(/[,;\n]/)
    .map((color) => color.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function resolvePreviewColors(profile: CompanyProfile, theme?: (typeof visualThemes)[number]) {
  const customColors = getProfileColorTokens(profile.colors);
  const hexColors = customColors.filter((color) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color));

  if (hexColors.length >= 2) {
    return [
      hexColors[0],
      hexColors[1],
      hexColors[2] || theme?.colors?.[2] || '#e5e7eb',
      hexColors[3] || theme?.colors?.[3] || hexColors[0],
    ];
  }

  return theme?.colors || ['#111827', '#ffffff', '#d1d5db'];
}

function buildCompanyContext(profile: CompanyProfile) {
  const selectedTheme = visualThemes.find((theme) => theme.id === profile.visualTheme);
  const effectiveIndustry = profile.customArea || profile.industry;
  const customColors = getProfileColorTokens(profile.colors);

  return [
    `Business stage: ${profile.businessStage || 'not specified'}`,
    `Selected visual theme: ${selectedTheme ? `${selectedTheme.title} — ${selectedTheme.prompt}` : 'not specified'}`,
    `Niche interests: ${profile.nicheInterests || 'not specified'}`,
    `Skills / unfair advantage: ${profile.skills || 'not specified'}`,
    `Start budget: ${profile.startBudget || 'not specified'}`,
    `Time available: ${profile.timeAvailable || 'not specified'}`,
    `Preferred business model: ${profile.preferredBusinessModel || 'not specified'}`,
    `Preferred market / customer type: ${profile.marketPreference || 'not specified'}`,
    `Initial niche ideas: ${profile.nicheIdeas || 'not specified'}`,
    `Custom selected area: ${profile.customArea || 'not specified'}`,
    `Company name: ${profile.companyName || 'use placeholder company name or propose one'}`,
    `Industry / niche: ${effectiveIndustry || 'not specified'}`,
    `Business idea: ${profile.businessIdea || 'not specified'}`,
    `Existing visual identity: ${profile.hasVisualIdentity || 'not specified'}`,
    `Desired visual direction / inspiration: ${profile.visualInspiration || 'not specified'}`,
    `Slogan: ${profile.slogan || 'not specified; propose one if useful'}`,
    `Offer: ${profile.offer || 'not specified'}`,
    `Main promoted product/service: ${profile.mainProduct || 'not specified'}`,
    `Unique value proposition: ${profile.uniqueValue || 'not specified'}`,
    `Target audience: ${profile.audience || 'not specified'}`,
    `Customer problem: ${profile.customerProblem || 'not specified'}`,
    `Location: ${profile.city || 'not specified'}`,
    `Address: ${profile.address || 'not specified'}`,
    `Website: ${profile.website || 'not specified'}`,
    `Social media: ${profile.instagram || 'not specified'}`,
    `Phone: ${profile.phone || 'not specified'}`,
    `Email: ${profile.email || 'not specified'}`,
    `Brand style: ${profile.brandStyle || 'propose a suitable style'}`,
    `Brand colors: ${profile.colors || 'choose a tasteful palette matching the industry'}`,
    `Parsed custom color preferences: ${customColors.length > 0 ? customColors.join(', ') : 'not specified'}`,
    `Logo / symbol idea: ${profile.logoIdea || 'propose a simple suitable concept'}`,
    `Tone of voice: ${profile.tone || 'simple, clear, professional'}`,
    `Call to action: ${profile.callToAction || 'choose a natural CTA'}`,
    `Print notes: ${profile.printNotes || 'keep it adaptable for print and digital use'}`,
    `Avoid: ${profile.avoid || 'avoid visual clutter and low quality design'}`,
    `Extra notes: ${profile.extra || 'none'}`,
  ].join('\n');
}

function buildMaterialPrompt(profile: CompanyProfile, material: MaterialTemplate) {
  const selectedTheme = visualThemes.find((theme) => theme.id === profile.visualTheme);
  const customColors = getProfileColorTokens(profile.colors);

  return [
    material.promptGoal,
    '',
    `MATERIAL: ${material.title}`,
    `TARGET FORMAT SELECTED IN APP: ${material.format}`,
    '',
    'Use the company profile below as the source of truth. Keep all visible text readable, clean and professional.',
    profile.businessStage === 'exploring'
      ? 'Important: the user is searching for a niche. Suggest concrete niche directions and make the visualisation useful for deciding what to test first.'
      : '',
    profile.businessStage === 'idea'
      ? 'Important: the user only has an idea. Do not assume the company is already established; help turn the idea into a credible first brand concept.'
      : '',
    '',
    'COMPANY PROFILE:',
    buildCompanyContext(profile),
    '',
    'MATERIAL STRUCTURE:',
    ...material.sections.map((section) => `- ${section}`),
    '',
    'DESIGN RULES:',
    selectedTheme ? `- visual style preset: ${selectedTheme.prompt}` : '- infer the best visual style from the company profile',
    customColors.length > 0
      ? `- IMPORTANT: use these user-provided brand colors as priority: ${customColors.join(', ')}. The visual preset should guide mood/layout, but these colors should dominate the palette.`
      : '- if no brand colors are provided, choose a tasteful palette matching the industry and selected visual style',
    '- create only this one selected material, not a combined package',
    '- keep a consistent premium brand identity',
    '- clean layout, strong spacing, high readability',
    '- keep color contrast high and text readable',
    '- no watermark',
    '- prepare it so the user can later adapt it for print or social media',
    '- use Polish language for visible copy unless the company profile clearly suggests another language',
  ].filter(Boolean).join('\n');
}

function textHasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferBusinessArea(profile: CompanyProfile, selectedArea: string) {
  if (selectedArea === 'other' && profile.customArea.trim()) {
    return 'other';
  }

  const freshText = [
    profile.customArea,
    profile.industry,
    profile.businessIdea,
    profile.nicheInterests,
    profile.nicheIdeas,
    profile.mainProduct,
    profile.offer,
  ].join(' ').toLowerCase();
  const fullText = [
    freshText,
    profile.audience,
    profile.customerProblem,
    selectedArea,
  ].join(' ').toLowerCase();

  const signals = {
    sports: textHasAny(freshText, ['piłk', 'pilk', 'football', 'futbol', 'sport', 'magazyn', 'liga', 'klub', 'kibic', 'stadion', 'mecz']),
    realEstate: textHasAny(freshText, ['nieruch', 'mieszka', 'deweloper', 'najem', 'home staging', 'agent nieruch', 'apartament']),
    social: textHasAny(fullText, ['social', 'content', 'media', 'instagram', 'tiktok', 'karuzel', 'reklam']),
    local: textHasAny(fullText, ['lokal', 'beauty', 'salon', 'gastronom', 'remont', 'usług']),
    hairdresser: textHasAny(freshText, ['fryzjer', 'barber', 'włosy', 'wlosy']),
    beauty: textHasAny(freshText, ['beauty', 'kosmet', 'paznok', 'makija', 'spa', 'estetycz']),
    gastronomy: textHasAny(freshText, ['gastro', 'restaur', 'kawiar', 'catering', 'food', 'jedzenie']),
    ecommerce: textHasAny(freshText, ['e-commerce', 'ecommerce', 'sklep internet', 'sklep online', 'produkt']),
    expert: textHasAny(fullText, ['ekspert', 'dorad', 'konsult', 'trener', 'kancelar', 'edukac']),
  };

  if (signals.sports) return 'sports-media';
  if (signals.realEstate) return 'real-estate';
  if (signals.hairdresser) return 'hairdresser';
  if (signals.beauty) return 'beauty';
  if (signals.gastronomy) return 'gastronomy';
  if (signals.ecommerce) return 'ecommerce';
  if (signals.social) return 'social-media';
  if (signals.local) return 'local-business';
  if (signals.expert) return 'expert-services';
  return selectedArea;
}

function analyzeBrief(profile: CompanyProfile, stage: StageId, selectedArea: string, selectedMaterials: MaterialTemplate[]) {
  const inferredArea = inferBusinessArea(profile, selectedArea);
  const customAreaMode = selectedArea === 'other' && profile.customArea.trim();
  const effectiveIndustry = customAreaMode ? profile.customArea : profile.industry;
  const effectiveNiche = customAreaMode ? profile.customArea : profile.nicheInterests;
  const areaText = `${inferredArea} ${effectiveIndustry} ${effectiveNiche} ${profile.businessIdea} ${profile.offer}`.toLowerCase();
  const isSports = inferredArea === 'sports-media';
  const isRealEstate = !isSports && (areaText.includes('real-estate') || areaText.includes('nieruch'));
  const isSocial = areaText.includes('social') || areaText.includes('media') || areaText.includes('content');
  const isLocal = areaText.includes('local') || areaText.includes('lokal') || areaText.includes('usługi');
  const selectedTheme = visualThemes.find((theme) => theme.id === profile.visualTheme);

  const summary =
    stage === 'exploring'
      ? `Kierunek: eksploracja niszy w obszarze ${effectiveNiche || effectiveIndustry || 'do doprecyzowania'}.`
      : stage === 'idea'
        ? `Kierunek: walidacja pomysłu „${profile.businessIdea || 'do doprecyzowania'}”.`
        : `Kierunek: materiały dla marki ${profile.companyName || 'bez nazwy'} w branży ${effectiveIndustry || 'do doprecyzowania'}.`;

  const likelyAudience =
    profile.audience ||
    profile.marketPreference ||
    (isSports ? 'kibice piłki nożnej, czytelnicy magazynu sportowego i osoby śledzące newsy oraz analizy' : '') ||
    (isRealEstate ? 'właściciele mieszkań, inwestorzy i klienci premium' : '') ||
    (isSocial ? 'właściciele firm, eksperci i marki osobiste' : '') ||
    (isLocal ? 'lokalni klienci szukający zaufanej usługi' : '') ||
    'klient docelowy wymaga doprecyzowania';

  const mainProblem =
    profile.customerProblem ||
    (isSports ? 'odbiorcy chcą szybkich, ciekawych i czytelnie podanych treści sportowych' : '') ||
    (isRealEstate ? 'słaba prezentacja oferty i trudność w sprzedaży za dobrą cenę' : '') ||
    (isSocial ? 'brak czasu i pomysłu na regularną komunikację' : '') ||
    (isLocal ? 'brak profesjonalnego wizerunku i prostego kontaktu' : '') ||
    'problem klienta wymaga doprecyzowania';

  const recommendedMaterials = selectedMaterials.map((material) => material.title).join(', ');
  const missing = [
    !profile.companyName && stage !== 'exploring' ? 'nazwa lub nazwa robocza' : '',
    !profile.audience && !profile.marketPreference ? 'klient docelowy' : '',
    !profile.offer && !profile.mainProduct && stage !== 'exploring' ? 'oferta lub produkt' : '',
    !profile.customerProblem ? 'problem klienta' : '',
    !profile.visualTheme ? 'styl wizualny' : '',
  ].filter(Boolean);

  return {
    summary,
    likelyAudience,
    mainProblem,
    visualDirection: selectedTheme?.title || profile.brandStyle || profile.visualInspiration || 'AI powinno zaproponować styl',
    recommendedMaterials,
    missing,
  };
}

function getRecommendedPresets(stage: StageId, selectedArea: string, profile: CompanyProfile) {
  const inferredArea = inferBusinessArea(profile, selectedArea);
  const customAreaMode = selectedArea === 'other' && profile.customArea.trim();
  const freshText = customAreaMode
    ? `${profile.customArea} ${profile.businessIdea} ${profile.nicheIdeas} ${profile.offer}`.toLowerCase()
    : `${profile.customArea} ${profile.industry} ${profile.nicheInterests} ${profile.businessIdea} ${profile.nicheIdeas} ${profile.offer}`.toLowerCase();
  const sportsSignal = inferredArea === 'sports-media';

  const scored = packagePresets
    .filter((preset) => preset.stageIds.includes(stage))
    .map((preset) => {
      let score = preset.areaId === inferredArea ? 6 : 0;
      if (preset.areaId === selectedArea && selectedArea === inferredArea) score += 2;
      if (sportsSignal && preset.id.includes('sports')) score += 8;
      if (sportsSignal && preset.id.includes('real-estate')) score -= 20;
      if (!sportsSignal && freshText.includes('nieruch') && preset.id.includes('real-estate')) score += 5;
      if ((freshText.includes('social') || freshText.includes('content') || freshText.includes('media')) && preset.id.includes('social')) score += 5;
      if ((freshText.includes('lokal') || freshText.includes('beauty') || freshText.includes('usług')) && preset.id.includes('local')) score += 5;
      if ((freshText.includes('ekspert') || freshText.includes('dorad') || freshText.includes('konsult')) && preset.id.includes('expert')) score += 5;
      if (stage === 'exploring' && preset.id.includes('niche')) score += 6;
      return { preset, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map((item) => item.preset);
}

function getSuggestions(profile: CompanyProfile, selectedArea: string, question: ProfileQuestion) {
  const inferredArea = inferBusinessArea(profile, selectedArea);
  const customAreaMode = selectedArea === 'other' && profile.customArea.trim();
  const text = customAreaMode
    ? `${inferredArea} ${profile.customArea} ${profile.businessIdea} ${profile.offer}`.toLowerCase()
    : `${inferredArea} ${profile.customArea} ${profile.industry} ${profile.nicheInterests} ${profile.businessIdea}`.toLowerCase();
  const isSports = inferredArea === 'sports-media';
  const isRealEstate = !isSports && (text.includes('real-estate') || text.includes('nieruch'));
  const isSocial = text.includes('social') || text.includes('content') || text.includes('media');
  const isLocal = text.includes('local') || text.includes('lokal') || text.includes('usługi');

  const common: Partial<Record<keyof CompanyProfile, string[]>> = {
    businessIdea: [
      'Chcę zbudować markę premium, która od razu wygląda wiarygodnie i profesjonalnie.',
      'Chcę sprawdzić wizualny kierunek marki przed startem firmy.',
      'Potrzebuję pakietu startowego: koncept, brandbook, oferta i posty.',
    ],
    preferredBusinessModel: ['usługi premium', 'produkt cyfrowy', 'agencja / obsługa firm', 'marka osobista i konsultacje'],
    startBudget: ['chcę zacząć praktycznie bez kosztów', 'mam 1000-3000 zł na start', 'mam 5000-10000 zł na test niszy'],
    timeAvailable: ['5 godzin tygodniowo po pracy', 'weekendy i wieczory', 'pełny etat — chcę potraktować to poważnie'],
    visualInspiration: [
      'minimalistycznie, premium, dużo bieli, czarna typografia, elegancki układ',
      'nowocześnie, dynamicznie, mocny kontrast, styl marki technologicznej',
      'ciepło, lokalnie, przyjaźnie, naturalne kolory i dużo światła',
    ],
    brandStyle: ['premium, minimalistyczny, elegancki, z dużą ilością przestrzeni', 'nowoczesny, odważny, kontrastowy, sprzedażowy'],
    colors: ['czerń, biel, złoto, subtelna szarość', 'granat, biel, srebro, jasny błękit', 'beż, oliwka, biel, naturalne brązy'],
    tone: ['ekspercki, konkretny, prosty, premium', 'przyjazny, lokalny, bez nadęcia', 'sprzedażowy, dynamiczny'],
    callToAction: ['Umów bezpłatną konsultację', 'Napisz do nas', 'Sprawdź ofertę'],
  };

  const realEstate: Partial<Record<keyof CompanyProfile, string[]>> = {
    nicheInterests: ['nieruchomości premium, inwestowanie, home staging, prezentacje ofert', 'najem krótkoterminowy, inwestorzy, sprzedaż mieszkań'],
    nicheIdeas: ['social media dla biur nieruchomości premium', 'home staging i prezentacje ofert mieszkań wspierane AI', 'pakiety ofert inwestycyjnych dla agentów'],
    businessIdea: ['Pomagam sprzedawać nieruchomości szybciej dzięki lepszej prezentacji, grafikom i komunikacji premium.'],
    offer: ['sprzedaż mieszkań premium, przygotowanie oferty, sesja zdjęciowa, home staging, negocjacje'],
    audience: ['właściciele mieszkań, którzy chcą sprzedać nieruchomość szybko i za dobrą cenę', 'inwestorzy szukający mieszkań pod wynajem'],
    uniqueValue: ['premium prezentacja nieruchomości, mocny marketing, baza inwestorów, pełna obsługa sprzedaży'],
    customerProblem: ['klient nie wie, jak dobrze wycenić mieszkanie i boi się sprzedać za tanio', 'oferty konkurencji wyglądają słabo i nie przyciągają kupujących'],
    visualInspiration: ['premium real estate, białe tło, czarna typografia, złote akcenty, luksusowy magazyn'],
  };

  const social: Partial<Record<keyof CompanyProfile, string[]>> = {
    nicheIdeas: ['pakiety contentowe dla agentów nieruchomości', 'social media dla lokalnych firm premium', 'karuzele edukacyjne dla ekspertów'],
    offer: ['prowadzenie profili social media, strategia treści, grafiki, rolki, kampanie reklamowe'],
    audience: ['właściciele małych firm, którzy nie mają czasu prowadzić social mediów', 'marki osobiste, eksperci, trenerzy i usługodawcy'],
    visualInspiration: ['odważne kolory, nowoczesna typografia, kreatywny agencyjny styl'],
  };

  const local: Partial<Record<keyof CompanyProfile, string[]>> = {
    nicheIdeas: ['pakiety startowe dla salonów beauty', 'wizytówki i grafiki dla lokalnych usług premium', 'mini brandbooki dla nowych firm lokalnych'],
    offer: ['lokalna usługa premium z prostą ofertą, jasnym cennikiem i szybkim kontaktem'],
    audience: ['klienci z okolicy, którzy chcą szybkiej i zaufanej obsługi'],
    visualInspiration: ['ciepła lokalna marka, dużo światła, naturalne kolory, przyjazny styl'],
  };

  const sports: Partial<Record<keyof CompanyProfile, string[]>> = {
    businessIdea: ['Chcę stworzyć magazyn / projekt medialny o piłce nożnej z newsami, analizami i mocną identyfikacją wizualną.'],
    nicheIdeas: ['magazyn piłkarski dla kibiców konkretnej ligi', 'newsletter z analizami meczów i transferów', 'portal social media z szybkimi newsami piłkarskimi'],
    offer: ['newsy piłkarskie, analizy meczowe, karuzele edukacyjne, rankingi, newsletter i treści dla społeczności kibiców'],
    audience: ['kibice piłki nożnej, osoby śledzące ligi, transfery, analizy i ciekawostki sportowe'],
    customerProblem: ['odbiorcy mają dość chaotycznych newsów i chcą czytelnego, atrakcyjnego magazynu sportowego'],
    uniqueValue: ['szybkie newsy, czytelne analizy, mocny styl magazynowy i spójna marka wokół piłki nożnej'],
    visualInspiration: ['nowoczesny magazyn sportowy, mocne nagłówki, kontrast, energia stadionu, dynamiczne layouty'],
    brandStyle: ['dynamiczny, magazynowy, sportowy, kontrastowy, bardzo czytelny'],
    colors: ['zieleń boiska, czerń, biel, neonowy akcent', 'granat, biel, żółty akcent, styl sport premium'],
    tone: ['dynamiczny, konkretny, sportowy, lekko ekspercki'],
    callToAction: ['Obserwuj po więcej analiz', 'Dołącz do newslettera', 'Sprawdź najnowsze newsy'],
  };

  return Array.from(new Set([
    ...(common[question.key] || []),
    ...(isSports ? sports[question.key] || [] : []),
    ...(isRealEstate ? realEstate[question.key] || [] : []),
    ...(isSocial ? social[question.key] || [] : []),
    ...(isLocal ? local[question.key] || [] : []),
  ])).slice(0, 6);
}

const CompanyAssistant = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
  const [selectedArea, setSelectedArea] = useState(areaOptions[0].id);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(defaultMaterialIdsByStage.existing);
  const [savedPackages, setSavedPackages] = useState<SavedPackage[]>([]);

  useEffect(() => {
    const loaded = loadProfile();
    setProfile(loaded);
    if (loaded.businessStage) setSelectedMaterialIds(defaultMaterialIdsByStage[loaded.businessStage]);
    setSavedPackages(loadSavedPackages());

    vpsFetch<CompanyAssistantPackagesResponse>('/me/company-assistant-packages?limit=20')
      .then((data) => {
        if (Array.isArray(data.packages)) {
          setSavedPackages(data.packages);
          window.localStorage.setItem(SAVED_PACKAGES_STORAGE_KEY, JSON.stringify(data.packages));
        }
      })
      .catch((error) => {
        console.error('Company assistant packages load error:', error);
      });
  }, []);

  const activeStage = profile.businessStage || 'existing';

  const activeQuestions = useMemo(
    () => questionsByStage[activeStage].filter((question) => question.key !== 'industry' && question.key !== 'nicheInterests'),
    [activeStage],
  );
  const availableMaterials = useMemo(
    () => materials.filter((material) => materialIdsByStage[activeStage].includes(material.id)),
    [activeStage],
  );
  const questionIndex = currentStep - 2;
  const currentQuestion = activeQuestions[questionIndex];
  const areaStep = 1;
  const materialsStep = activeQuestions.length + 2;
  const summaryStep = activeQuestions.length + 3;
  const totalSteps = summaryStep + 1;
  const isQuestionStep = currentStep > areaStep && currentStep < materialsStep;
  const stageTitle = businessStages.find((stage) => stage.id === activeStage)?.title || 'Mam już firmę';
  const selectedMaterials = useMemo(() => {
    const filtered = availableMaterials.filter((material) => selectedMaterialIds.includes(material.id));
    return filtered.length > 0 ? filtered : availableMaterials.slice(0, 1);
  }, [availableMaterials, selectedMaterialIds]);
  const materialPrompts = useMemo<SavedMaterialPrompt[]>(
    () =>
      selectedMaterials.map((material) => ({
        materialId: material.id,
        title: material.title,
        format: material.format,
        style: material.style,
        prompt: buildMaterialPrompt(profile, material),
      })),
    [profile, selectedMaterials],
  );
  const answeredCount = activeQuestions.filter((question) => String(profile[question.key] || '').trim()).length;
  const questionProgress = activeQuestions.length > 0 ? Math.min(100, Math.max(0, ((questionIndex + 1) / activeQuestions.length) * 100)) : 0;
  const suggestions = currentQuestion ? getSuggestions(profile, selectedArea, currentQuestion) : [];
  const briefAnalysis = useMemo(
    () => analyzeBrief(profile, activeStage, selectedArea, selectedMaterials),
    [activeStage, profile, selectedArea, selectedMaterials],
  );
  const recommendedPresets = useMemo(
    () => getRecommendedPresets(activeStage, selectedArea, profile),
    [activeStage, profile, selectedArea],
  );

  const updateProfile = (key: keyof CompanyProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const selectStage = (stage: StageId) => {
    setProfile((current) => ({ ...current, businessStage: stage }));
    setSelectedMaterialIds(defaultMaterialIdsByStage[stage]);
    setCurrentStep(0);
  };

  const applySuggestion = (question: ProfileQuestion, suggestion: string) => {
    const currentValue = String(profile[question.key] || '').trim();
    const nextValue = question.multiline
      ? currentValue
        ? `${currentValue}\n${suggestion}`
        : suggestion
      : currentValue
        ? `${currentValue}, ${suggestion}`
        : suggestion;

    updateProfile(question.key, nextValue);
  };

  const applyPreset = (preset: PackagePreset) => {
    setSelectedArea(preset.areaId);
    setSelectedMaterialIds(preset.materialIds);
    setProfile((current) => {
      const next: CompanyProfile = {
        ...current,
        visualTheme: current.visualTheme || preset.visualTheme,
      };

      Object.entries(preset.profilePatch).forEach(([key, value]) => {
        const profileKey = key as keyof CompanyProfile;
        if (!String(next[profileKey] || '').trim() && typeof value === 'string') {
          next[profileKey] = value;
        }
      });

      return next;
    });
    toast.success(`Zastosowano pakiet: ${preset.title}`);
  };

  const saveProfile = () => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    toast.success('Profil zapisany');
  };

  const savePromptPackage = async () => {
    const payload = {
      companyName: profile.companyName || (activeStage === 'exploring' ? 'Eksploracja niszy' : 'Projekt bez nazwy'),
      industry: profile.customArea || profile.industry || profile.nicheInterests || stageTitle,
      profile,
      prompts: materialPrompts,
    };
    const fallbackPackage: SavedPackage = {
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
      companyName: payload.companyName,
      industry: payload.industry,
      prompts: materialPrompts,
    };

    try {
      const data = await vpsFetch<SaveCompanyAssistantPackageResponse>('/me/company-assistant-packages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const saved = data.package;
      const nextPackages = [saved, ...savedPackages.filter((item) => item.id !== saved.id)].slice(0, 20);

      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      window.localStorage.setItem(SAVED_PACKAGES_STORAGE_KEY, JSON.stringify(nextPackages));
      setSavedPackages(nextPackages);
      toast.success('Pakiet promptów zapisany w panelu użytkownika');
    } catch (error) {
      console.error('Company assistant package save error:', error);
      const nextPackages = [fallbackPackage, ...savedPackages].slice(0, 20);
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      window.localStorage.setItem(SAVED_PACKAGES_STORAGE_KEY, JSON.stringify(nextPackages));
      setSavedPackages(nextPackages);
      toast.error('Nie udało się zapisać na koncie. Zapisano lokalnie w tej przeglądarce.');
    }
  };

  const toggleMaterial = (materialId: string) => {
    setSelectedMaterialIds((current) => {
      if (current.includes(materialId)) {
        if (current.length === 1) {
          toast.info('Wybierz przynajmniej jeden materiał');
          return current;
        }
        return current.filter((id) => id !== materialId);
      }
      return [...current, materialId];
    });
  };

  const usePromptInGenerator = (materialPrompt: SavedMaterialPrompt) => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.sessionStorage.setItem('companyAssistantPrompt', materialPrompt.prompt);
    window.sessionStorage.setItem('companyAssistantFormat', materialPrompt.format);
    window.sessionStorage.setItem('companyAssistantStyle', materialPrompt.style);
    toast.success(`${materialPrompt.title} przeniesiono do generatora`);
    navigate('/generator');
  };

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    toast.success('Prompt skopiowany');
  };

  const goNext = () => setCurrentStep((step) => Math.min(summaryStep, step + 1));
  const goBack = () => setCurrentStep((step) => Math.max(0, step - 1));
  const goNextFromArea = () => {
    const selectedOption = areaOptions.find((option) => option.id === selectedArea);

    if (selectedArea === 'other') {
      const customArea = profile.customArea.trim();
      if (!customArea) {
        toast.error('Wpisz własną branżę lub pomysł');
        return;
      }

      setProfile((current) => ({
        ...current,
        customArea,
        industry: customArea,
        nicheInterests: customArea,
      }));
      goNext();
      return;
    }

    if (selectedOption) {
      setProfile((current) => ({
        ...current,
        customArea: '',
        industry: selectedOption.title,
        nicheInterests: activeStage === 'exploring' ? selectedOption.title : current.nicheInterests,
      }));
    }

    goNext();
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <BriefcaseBusiness className="inline w-7 h-7 text-primary mr-2" />
              Asystent materiałów <span className="gradient-text">dla firmy</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Wybierz ścieżkę, odpowiedz na właściwe pytania i zapisz osobne prompty do materiałów.
            </p>
          </div>
          <Button onClick={saveProfile} className="gradient-bg gap-1.5">
            <Save className="w-4 h-4" /> Zapisz profil
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Ścieżka: {stageTitle}</span>
              {isQuestionStep ? (
                <span>Pytanie {questionIndex + 1} z {activeQuestions.length} • Uzupełniono {answeredCount}/{activeQuestions.length}</span>
              ) : (
                <span>Etap {currentStep + 1} z {totalSteps}</span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full gradient-bg transition-all"
                style={{ width: `${isQuestionStep ? questionProgress : ((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {currentStep === 0 && (
          <motion.div key="stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Na jakim etapie jesteś?</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ten wybór zmienia cały kreator: pytania, podpowiedzi i domyślne materiały.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {businessStages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => selectStage(stage.id)}
                    className={cn(
                      'text-left rounded-xl border p-4 transition-all hover:shadow-md',
                      activeStage === stage.id ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card',
                    )}
                  >
                    <p className="font-semibold">{stage.title}</p>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                    <p className="mt-2 text-xs text-primary">{stage.outcome}</p>
                  </button>
                ))}
                <div className="sm:col-span-2 rounded-xl border bg-primary/5 p-4">
                  <p className="font-semibold">Korzyści tej ścieżki</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {benefitsByStage[activeStage].map((benefit) => (
                      <li key={benefit} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="sm:col-span-2 flex justify-end pt-2">
                  <Button className="gradient-bg" onClick={goNext}>Dalej</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentStep === areaStep && (
          <motion.div key="area" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {activeStage === 'exploring' ? 'Wybierz obszar do eksploracji' : 'Wybierz najbliższy obszar'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {activeStage === 'exploring'
                    ? 'To nie jest jeszcze wybór firmy — to punkt startowy do szukania niszy.'
                    : 'Ten wybór uruchomi lepsze podpowiedzi branżowe.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branża / obszar</label>
                  <Select
                    value={selectedArea}
                    onValueChange={(value) => {
                      setSelectedArea(value);
                      const selectedOption = areaOptions.find((option) => option.id === value);
                      if (value === 'other') {
                        updateProfile('industry', '');
                        updateProfile('nicheInterests', '');
                        return;
                      }
                      if (value !== 'other' && selectedOption) {
                        updateProfile('customArea', '');
                        if (activeStage === 'exploring') updateProfile('nicheInterests', selectedOption.title);
                        updateProfile('industry', selectedOption.title);
                        if (value === 'tattoo' && !profile.visualTheme) updateProfile('visualTheme', 'tattoo-dark-ink');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz branżę" />
                    </SelectTrigger>
                    <SelectContent>
                      {areaOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedArea === 'other' && (
                  <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                    <label className="text-sm font-medium">Wpisz własną branżę lub pomysł</label>
                    <Input
                      value={profile.customArea}
                      onChange={(event) => updateProfile('customArea', event.target.value)}
                      placeholder="np. sklep zoologiczny, studio tatuażu, magazyn piłkarski, barber"
                      className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                      Po kliknięciu Dalej kreator użyje tego tekstu do podpowiedzi i analizy briefu.
                    </p>
                  </div>
                )}

                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={goBack}>Wstecz</Button>
                  <Button className="gradient-bg" onClick={goNextFromArea}>Dalej</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isQuestionStep && currentQuestion && (
          <motion.div key={`${activeStage}-${currentQuestion.key}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Pytanie {questionIndex + 1}: {currentQuestion.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{currentQuestion.helper}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  {currentQuestion.multiline ? (
                    <Textarea
                      value={profile[currentQuestion.key]}
                      onChange={(event) => updateProfile(currentQuestion.key, event.target.value)}
                      placeholder={currentQuestion.placeholder}
                      className="min-h-[140px] bg-background"
                    />
                  ) : (
                    <Input
                      value={profile[currentQuestion.key]}
                      onChange={(event) => updateProfile(currentQuestion.key, event.target.value)}
                      placeholder={currentQuestion.placeholder}
                      className="bg-background"
                    />
                  )}
                </div>

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Podpowiedzi — kliknij, żeby dodać:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-left text-xs"
                          onClick={() => applySuggestion(currentQuestion, suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-2">
                  <Button variant="outline" onClick={goBack}>Wstecz</Button>
                  <Button className="gradient-bg" onClick={goNext}>
                    {questionIndex === activeQuestions.length - 1 ? 'Dalej do materiałów' : 'Następne pytanie'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentStep === materialsStep && (
          <motion.div key="materials" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Wybierz styl wizualny</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Styl wpływa na prompty i szybkie podglądy. Jeśli nie wybierzesz, AI dobierze styl samo.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="font-semibold">Własne kolory marki</p>
                    <p className="text-sm text-muted-foreground">
                      Możesz wpisać nazwy kolorów albo kody HEX. Te kolory będą ważniejsze niż gotowy preset.
                    </p>
                  </div>
                  <Input
                    value={profile.colors}
                    onChange={(event) => updateProfile('colors', event.target.value)}
                    placeholder="np. czarny, czerwony, srebrny albo #111111, #c1121f, #f8f9fa"
                    className="bg-background"
                  />
                  {getProfileColorTokens(profile.colors).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {getProfileColorTokens(profile.colors).map((color) => (
                        <span key={color} className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground border">
                          {color}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-semibold">Gotowe kierunki wizualne</p>
                      <p className="text-sm text-muted-foreground">Wybierz klimat marki. Kolory własne mogą go nadpisać.</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{visualThemes.length} palet</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visualThemes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => updateProfile('visualTheme', theme.id)}
                        className={cn(
                          'rounded-xl border p-4 text-left transition-all hover:shadow-md',
                          profile.visualTheme === theme.id ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card',
                        )}
                      >
                        <div className="mb-3 flex gap-1">
                          {theme.colors.map((color) => (
                            <span key={color} className="h-5 w-9 rounded-full border" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                        <p className="font-semibold">{theme.title}</p>
                        <p className="text-sm text-muted-foreground">{theme.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Wybierz materiały</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Materiały są dopasowane do ścieżki. Każdy zaznaczony materiał dostanie osobny prompt.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableMaterials.map((material) => {
                  const Icon = material.icon;
                  const selected = selectedMaterialIds.includes(material.id);

                  return (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => toggleMaterial(material.id)}
                      className={cn(
                        'w-full rounded-xl border p-4 text-left transition-all hover:shadow-md',
                        selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card',
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-lg gradient-bg flex items-center justify-center text-primary-foreground shrink-0">
                          {selected ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{material.title}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{material.category}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{material.format}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{material.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="flex flex-wrap justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={goBack}>Wstecz</Button>
                  <Button className="gradient-bg" onClick={goNext}>Dalej do promptów</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Podgląd wybranych materiałów</CardTitle>
                <p className="text-sm text-muted-foreground">
                  To szybki szkic na podstawie briefu. Właściwe grafiki wygenerujesz później w generatorze.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedMaterials.map((material) => (
                  <MaterialPreview
                    key={material.id}
                    material={material}
                    profile={profile}
                    theme={visualThemes.find((theme) => theme.id === profile.visualTheme)}
                  />
                ))}
              </CardContent>
            </Card>
            </div>
          </motion.div>
        )}

        {currentStep === summaryStep && (
          <motion.div key="summary" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Osobne prompty do wygenerowania</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Zapisz pakiet, a potem generuj każdą rzecz osobno. Grafiki po generowaniu znajdziesz w Galerii.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={savePromptPackage} className="gradient-bg gap-1.5">
                    <Save className="w-4 h-4" /> Zapisz pakiet promptów
                  </Button>
                  <Button variant="outline" onClick={goBack}>Wstecz</Button>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="font-semibold">Analiza briefu</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <BriefRow label="Kierunek" value={briefAnalysis.summary} />
                    <BriefRow label="Klient" value={briefAnalysis.likelyAudience} />
                    <BriefRow label="Problem" value={briefAnalysis.mainProblem} />
                    <BriefRow label="Styl" value={briefAnalysis.visualDirection} />
                    <BriefRow label="Materiały" value={briefAnalysis.recommendedMaterials} />
                    <BriefRow
                      label="Do doprecyzowania"
                      value={briefAnalysis.missing.length > 0 ? briefAnalysis.missing.join(', ') : 'Brief wygląda wystarczająco dobrze do pierwszej generacji.'}
                    />
                  </div>
                </div>

                {materialPrompts.map((item) => (
                  <Card key={item.materialId} className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {item.title}
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{item.format}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea value={item.prompt} readOnly className="min-h-[180px] text-xs leading-relaxed" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button onClick={() => copyPrompt(item.prompt)} variant="outline" className="gap-1.5">
                          <Copy className="w-4 h-4" /> Kopiuj prompt
                        </Button>
                        <Button onClick={() => usePromptInGenerator(item)} className="gradient-bg gap-1.5">
                          <Wand2 className="w-4 h-4" /> Przejdź do generatora
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Panel zapisanych pakietów</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pakiety promptów są zapisane na Twoim koncie. Wygenerowane grafiki są zapisywane osobno w Galerii.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedPackages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nie masz jeszcze zapisanych pakietów.</p>
                ) : (
                  savedPackages.map((pack) => (
                    <div key={pack.id} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">{pack.companyName}</p>
                          <p className="text-xs text-muted-foreground">
                            {pack.industry} • {new Date(pack.createdAt).toLocaleString('pl-PL')}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{pack.prompts.length} promptów</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pack.prompts.map((prompt) => (
                          <Button key={`${pack.id}-${prompt.materialId}`} size="sm" variant="outline" onClick={() => usePromptInGenerator(prompt)}>
                            {prompt.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </AppLayout>
  );
};

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}

function MaterialPreview({
  material,
  profile,
  theme,
}: {
  material: MaterialTemplate;
  profile: CompanyProfile;
  theme?: (typeof visualThemes)[number];
}) {
  const colors = resolvePreviewColors(profile, theme);
  const customColors = getProfileColorTokens(profile.colors);
  const companyName = profile.companyName || (profile.businessStage === 'exploring' ? 'Nowa nisza' : 'Nazwa marki');
  const headline = profile.mainProduct || profile.offer || profile.businessIdea || profile.nicheIdeas || material.title;
  const cta = profile.callToAction || 'Napisz do nas';
  const subtitle = profile.uniqueValue || profile.customerProblem || profile.audience || profile.marketPreference || 'Profesjonalny materiał startowy';

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div
        className="aspect-[4/3] p-4"
        style={{
          background: `linear-gradient(135deg, ${colors[1] || '#ffffff'} 0%, ${colors[2] || '#e5e7eb'} 100%)`,
          color: colors[0] || '#111827',
        }}
      >
        <div className="flex h-full flex-col justify-between rounded-lg border border-black/10 bg-white/70 p-4 backdrop-blur-sm">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide">{companyName}</span>
              <span
                className="h-7 w-7 rounded-full"
                style={{ backgroundColor: colors[0] || '#111827' }}
              />
            </div>
            <p className="text-lg font-bold leading-tight">{headline}</p>
            <p className="mt-2 line-clamp-3 text-xs opacity-75">{subtitle}</p>
          </div>
          <div className="flex items-end justify-between gap-3">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: colors[0] || '#111827' }}>
              {cta}
            </span>
            <span className="text-[10px] opacity-60">{material.format}</span>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="font-medium">{material.title}</p>
        <p className="text-xs text-muted-foreground">
          {theme?.title || 'Styl dobrany przez AI'}{customColors.length > 0 ? ` • kolory: ${customColors.join(', ')}` : ''}
        </p>
      </div>
    </div>
  );
}

export default CompanyAssistant;
