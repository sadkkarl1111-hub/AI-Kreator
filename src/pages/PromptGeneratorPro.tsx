import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Copy,
  FileText,
  Megaphone,
  Monitor,
  PenLine,
  RectangleHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type PromptMode = 'builder' | 'improve';
type OutputLanguage = 'en' | 'pl';
type TemplateId = 'ad' | 'ebookMockup' | 'courseCover' | 'socialPost' | 'banner' | 'youtube';

type PromptForm = {
  mainText: string;
  subtitle: string;
  offer: string;
  cta: string;
  audience: string;
  style: string;
  colors: string;
  format: string;
  mustInclude: string;
  avoid: string;
};

type TemplateConfig = {
  id: TemplateId;
  label: string;
  shortLabel: string;
  icon: typeof Megaphone;
  description: string;
  defaults: PromptForm;
};

type StylePreset = {
  id: string;
  label: string;
  description: string;
  templateIds: TemplateId[];
  fields: Partial<PromptForm>;
};

type PromptExample = {
  id: string;
  label: string;
  description: string;
  templateId: TemplateId;
  form: PromptForm;
  language?: OutputLanguage;
};

const templates: TemplateConfig[] = [
  {
    id: 'ad',
    label: 'Grafika reklamowa',
    shortLabel: 'Reklama',
    icon: Megaphone,
    description: 'Post, reklama lub kreacja do kampanii z mocnym nagłówkiem i CTA.',
    defaults: {
      mainText: 'Inteligencja może sztuczna, ale generuje prawdziwych klientów',
      subtitle: '3 dniowe wyzwanie AI',
      offer: 'Warsztaty AI dla przedsiębiorców i marketerów',
      cta: 'Zarezerwuj miejsce',
      audience: 'właściciele firm, twórcy online, freelancerzy',
      style: 'mocny nowoczesny styl polskiej reklamy w mediach społecznościowych, wysoki kontrast, estetyka premium dla marketingu cyfrowego',
      colors: 'głębokie bordowe tło, neonowe limonkowe akcenty, biała gruba typografia, czarny przycisk CTA',
      format: 'kwadratowy post do mediów społecznościowych 1:1, kompozycja wyśrodkowana, bezpieczne marginesy dla tekstu',
      mustInclude: 'ekspert po prawej stronie, karteczki z 3 krótkimi punktami programu, mocny nagłówek po lewej',
      avoid: 'małego tekstu, literówek w języku polskim, chaotycznego układu, zbyt wielu ozdobników',
    },
  },
  {
    id: 'ebookMockup',
    label: 'Mockup ebooka lub produktu',
    shortLabel: 'Mockup',
    icon: BookOpen,
    description: 'Pudełko 3D, ebook, kurs, PDF albo produkt cyfrowy w stylu premium.',
    defaults: {
      mainText: 'JAK ZACZĄĆ INWESTOWAĆ',
      subtitle: '2 ŚCIEŻKI I 3 GOTOWE PLANY',
      offer: '200 zł | 500 zł | 1000 zł',
      cta: '',
      audience: 'osoby początkujące w inwestowaniu',
      style: 'ciemna kinowa estetyka finansowa, produkt edukacyjny premium, nowoczesny polski styl marketingu inwestycyjnego',
      colors: 'głębokie czarne tło, mocne czerwone akcenty, biała gruba typografia, subtelne świecące elementy wykresów',
      format: 'pionowe ujęcie produktu, front i grzbiet widoczne w perspektywie 3D, na czystym jasnym tle',
      mustInclude: 'wykresy świecowe, wykres rynku w tle, realistyczne cienie, światło studyjne, delikatne błyszczące odbicia',
      avoid: 'płaskiej okładki, złej perspektywy, nieczytelnego tekstu na grzbiecie, losowych napisów, zniekształconych polskich znaków',
    },
  },
  {
    id: 'courseCover',
    label: 'Okładka kursu lub PDF',
    shortLabel: 'Okładka',
    icon: FileText,
    description: 'Pionowa okładka z tytułem, podtytułem i spójną identyfikacją.',
    defaults: {
      mainText: 'PLAN MARKETINGU AI',
      subtitle: '30 gotowych zadań na pierwszy miesiąc',
      offer: 'PDF + checklisty + przykłady promptów',
      cta: '',
      audience: 'małe firmy i osoby tworzące treści online',
      style: 'czysty edukacyjny projekt okładki premium, nowoczesna estetyka SaaS i narzędzi dla twórców',
      colors: 'biała i grafitowa baza, elektryczne niebieskie akcenty, subtelna głębia gradientu',
      format: 'pionowa okładka 2:3, duży tytuł u góry, czytelny podtytuł, czysta dolna sekcja',
      mustInclude: 'abstrakcyjne elementy interfejsu AI, subtelna siatka, minimalistyczne ikony, mocna hierarchia typografii',
      avoid: 'wrażenia zdjęcia stockowego, bałaganu, małego tekstu, niespójnych fontów',
    },
  },
  {
    id: 'socialPost',
    label: 'Post w mediach społecznościowych',
    shortLabel: 'Post',
    icon: PenLine,
    description: 'Kreacja 1:1 lub 4:5 do Instagrama, Facebooka albo LinkedIna.',
    defaults: {
      mainText: '5 błędów w reklamach AI',
      subtitle: 'Sprawdź, zanim przepalisz budżet',
      offer: 'Krótki edukacyjny post z checklistą',
      cta: 'Zapisz na później',
      audience: 'marketerzy, właściciele firm i twórcy reklam',
      style: 'edytorska okładka karuzeli w mediach społecznościowych, wyraźna hierarchia, nowoczesny projekt marketingowy',
      colors: 'ciepłe białe tło, czarna typografia, czerwone etykiety akcentowe, subtelna papierowa tekstura',
      format: 'okładka posta Instagram 4:5, czytelność na telefonie, bezpieczne marginesy',
      mustInclude: 'numerowane elementy wizualne, czyste pole nagłówka, proste akcenty ikon',
      avoid: 'zbyt dużej ilości tekstu, ozdobnego bałaganu, nieczytelnych małych etykiet',
    },
  },
  {
    id: 'banner',
    label: 'Baner sprzedażowy',
    shortLabel: 'Baner',
    icon: RectangleHorizontal,
    description: 'Szeroki baner na stronę, reklamę, mail lub kampanię promocyjną.',
    defaults: {
      mainText: 'Nowy pakiet promptów AI',
      subtitle: 'Gotowe schematy do reklam, mockupów i mediów społecznościowych',
      offer: 'Pakiet startowy dla firm',
      cta: 'Pobierz teraz',
      audience: 'osoby, które tworzą grafiki marketingowe z AI',
      style: 'nowoczesny baner nastawiony na konwersję, czysty układ sprzedażowy, estetyka premium narzędzi dla twórców',
      colors: 'ciemna granatowa baza, akcenty cyjanowe i magenta, biała czytelna typografia',
      format: 'szeroki poziomy baner 16:9, CTA po prawej, podgląd produktu po lewej',
      mustInclude: 'czytelny przycisk CTA, wizualny podgląd kart promptów, miękka poświata, profesjonalne odstępy',
      avoid: 'przeładowanego układu, słabego kontrastu, małego CTA',
    },
  },
  {
    id: 'youtube',
    label: 'Miniatura YouTube',
    shortLabel: 'YouTube',
    icon: Monitor,
    description: 'Mocna miniatura z krótkim tekstem, kontrastem i dużym pierwszym planem.',
    defaults: {
      mainText: 'AI zrobiło reklamę za mnie',
      subtitle: 'Test generatora grafik',
      offer: 'Film edukacyjny o tworzeniu kreacji AI',
      cta: '',
      audience: 'osoby zainteresowane AI, marketingiem i narzędziami graficznymi',
      style: 'miniatura YouTube nastawiona na wysoki CTR, mocny kontrast, ekspresyjny komercyjny styl technologiczny',
      colors: 'czarne tło, żółte i cyjanowe akcenty, duża biała typografia',
      format: 'miniatura YouTube 16:9, duży czytelny tekst, mocna twarz lub zbliżenie produktu',
      mustInclude: 'zaskoczona twarz twórcy, podgląd grafiki wygenerowanej AI, strzałka lub znacznik wyróżnienia',
      avoid: 'małego tekstu, słabego kontrastu, zbyt wielu słów, generycznego stylu stockowego',
    },
  },
];

const stylePresets: StylePreset[] = [
  {
    id: 'dark-finance',
    label: 'Dark finance premium',
    description: 'Ciemna okładka inwestycyjna, złoto/czerwień, wykresy i wygląd produktu premium.',
    templateIds: ['courseCover', 'ebookMockup'],
    fields: {
      style: 'ciemna kinowa estetyka finansowa, produkt edukacyjny premium, mocny klimat inwestowania i tradingu, nowoczesny polski marketing finansowy',
      colors: 'głębokie czarne tło, metaliczna złota typografia, czerwone lub cyjanowe akcenty wykresów, subtelne ciemne gradienty',
      mustInclude: 'wykresy świecowe, świecący wykres rynku, geometryczne elementy premium, duży tytuł wersalikami, czysta hierarchia frontu okładki',
      avoid: 'taniego stockowego wyglądu, płaskiej okładki, małych liczb finansowych, losowego tekstu, zniekształconych polskich znaków',
    },
  },
  {
    id: 'clean-education',
    label: 'Clean edukacyjny',
    description: 'Jasna, czytelna okładka PDF/kursu z dużą typografią i spokojnym stylem premium.',
    templateIds: ['courseCover', 'ebookMockup', 'socialPost'],
    fields: {
      style: 'czysty edukacyjny projekt premium, nowoczesna estetyka okładki kursu, wyraźna hierarchia, edytorski układ, profesjonalny produkt wiedzy',
      colors: 'ciepłe białe tło, grafitowa typografia, jeden mocny kolor akcentowy, subtelne niebieskie lub fioletowe gradienty',
      mustInclude: 'duży czytelny tytuł, uporządkowany blok podtytułu, proste ikony, abstrakcyjne elementy edukacyjne, dużo oddechu',
      avoid: 'wizualnego bałaganu, dziecinnych ikon, niskiego kontrastu, zbyt wielu fontów, małych nieczytelnych etykiet',
    },
  },
  {
    id: 'neon-ai',
    label: 'Neon AI marketing',
    description: 'Mocny klimat AI, neonowe akcenty i dynamiczny wygląd pod sprzedaż/technologie.',
    templateIds: ['ad', 'courseCover', 'socialPost', 'banner', 'youtube'],
    fields: {
      style: 'mocny futurystyczny projekt marketingowy AI, wysoki kontrast, energiczna estetyka technologiczna, nowoczesny styl dla twórców',
      colors: 'ciemne grafitowe tło, neonowe cyjanowe i magenta akcenty, duża biała typografia, subtelna poświata',
      mustInclude: 'elementy interfejsu AI, smugi światła, abstrakcyjny wzór neuronowy, mocne pole nagłówka, czytelna strefa CTA',
      avoid: 'generycznej maskotki robota, nieczytelnego świecącego tekstu, przeładowanego cyberpunkowego tła, losowych dodatkowych słów',
    },
  },
  {
    id: 'luxury-minimal',
    label: 'Luksusowy minimal',
    description: 'Minimalistyczna okładka premium z dużą przestrzenią, elegancką typografią i detalem.',
    templateIds: ['courseCover', 'ebookMockup', 'banner'],
    fields: {
      style: 'luksusowy minimalistyczny projekt okładki, dopracowana typografia, edytorska estetyka produktu premium, spokojna kompozycja wysokiej klasy',
      colors: 'miękka złamana biel lub głęboka czerń jako baza, szampańskie złote akcenty, stonowane neutralne gradienty, elegancki kontrast',
      mustInclude: 'duży tytuł, subtelny emblemat, delikatna grafika liniowa, przestrzeń premium, mała elegancka plakietka lub oznaczenie edycji',
      avoid: 'krzykliwych kolorów, bałaganu, kreskówkowego stylu, tanich efektów 3D, przeładowanego tła',
    },
  },
  {
    id: 'bold-social',
    label: 'Bold social ads',
    description: 'Agresywna kreacja reklamowa do social mediów z hookiem, twarzą/produktem i CTA.',
    templateIds: ['ad', 'socialPost', 'youtube'],
    fields: {
      style: 'mocny nowoczesny styl reklamy w mediach społecznościowych, układ reakcji bezpośredniej nastawiony na konwersję, silny kontrast, projekt zatrzymujący scrollowanie',
      colors: 'głębokie czerwone lub czarne tło, neonowe limonkowe lub żółte akcenty, biała gruba typografia, mocny przycisk CTA',
      mustInclude: 'duży nagłówek, twarz człowieka lub produkt po jednej stronie, elementy karteczek, czytelny przycisk CTA, czytelność na telefonie',
      avoid: 'słabego nagłówka, małego tekstu, zbyt wielu naklejek, niskiego kontrastu, chaotycznego układu',
    },
  },
  {
    id: 'beauty-soft',
    label: 'Beauty / lifestyle',
    description: 'Miękki styl dla produktów beauty, wellness, kursów lifestyle i ofert osobistych.',
    templateIds: ['courseCover', 'ebookMockup', 'ad', 'socialPost'],
    fields: {
      style: 'miękki lifestyle design premium, elegancka estetyka marketingu beauty, czysta edytorska kompozycja, delikatny klimat fotografii produktowej',
      colors: 'ciepły beż, pudrowy róż, miękka biel, stonowane złote akcenty, gradienty naturalnego światła',
      mustInclude: 'miękkie cienie, delikatna typografia, detale lifestyle, czysty fokus na produkcie lub okładce',
      avoid: 'ciężkiego ciemnego klimatu, agresywnego kontrastu, bałaganu kosmetyków, taniego wrażenia zdjęcia stockowego',
    },
  },
  {
    id: 'saas-dashboard',
    label: 'SaaS / biznes',
    description: 'Nowoczesny styl dla aplikacji, narzędzi AI, checklist i produktów dla firm.',
    templateIds: ['courseCover', 'banner', 'ad', 'socialPost'],
    fields: {
      style: 'nowoczesny marketing SaaS, czysty system wizualny inspirowany panelem aplikacji, estetyka premium narzędzi biznesowych',
      colors: 'biała i łupkowa baza, elektryczne niebieskie akcenty, subtelne cyjanowe gradienty, ostra czarna typografia',
      mustInclude: 'karty panelu aplikacji, elementy checklisty, subtelna siatka, podgląd interfejsu produktu, czysta strefa CTA',
      avoid: 'chaotycznego interfejsu, fałszywego nieczytelnego tekstu w interfejsie, nadmiaru niebieskiego, generycznego korporacyjnego stocku',
    },
  },
];

const promptExamples: PromptExample[] = [
  {
    id: 'investing-cover',
    label: 'Okładka ebooka inwestycyjnego',
    description: 'Ciemna, premium okładka do PDF lub kursu finansowego.',
    templateId: 'courseCover',
    language: 'pl',
    form: {
      mainText: '4 FILARY INWESTOWANIA',
      subtitle: 'Fundament Twojej Emerytury i Bezpiecznego Kapitału',
      offer: 'Premium Edition | Ebook + plan działania',
      cta: '',
      audience: 'osoby początkujące i średniozaawansowane w inwestowaniu',
      style: 'ciemna okładka ebooka finansowego premium, kinowa estetyka inwestycyjna, elegancki projekt produktu edukacyjnego',
      colors: 'głębokie granatowo-czarne tło, metaliczna złota typografia, cyjanowe akcenty wykresów, subtelna poświata',
      format: 'pionowa okładka ebooka 2:3, duży tytuł, czytelny podtytuł, elegancka dolna plakietka premium',
      mustInclude: 'cztery złote filary połączone świecącymi liniami, subtelny wykres świecowy w tle, kompozycja bezpieczna pod grzbiet',
      avoid: 'tanich ikon pieniędzy, bałaganu, fałszywego małego tekstu, literówek w polskich znakach, amatorskiego płaskiego układu',
    },
  },
  {
    id: 'ai-course-cover',
    label: 'Okładka kursu AI',
    description: 'Nowoczesna okładka dla kursu, PDF lub checklisty o AI.',
    templateId: 'courseCover',
    language: 'pl',
    form: {
      mainText: 'PLAN MARKETINGU AI',
      subtitle: '30 gotowych zadań na pierwszy miesiąc',
      offer: 'PDF + checklisty + przykłady promptów',
      cta: '',
      audience: 'właściciele małych firm, marketerzy i twórcy online',
      style: 'nowoczesna edukacyjna okładka SaaS i AI, estetyka premium narzędzi dla twórców, czysty profesjonalny układ',
      colors: 'biała i grafitowa baza, elektryczne niebieskie i fioletowe akcenty, subtelne szklane gradienty',
      format: 'pionowa okładka 2:3, duży tytuł u góry, czysty blok podtytułu, czytelny podgląd na telefonie',
      mustInclude: 'karty panelu AI, elementy checklisty, subtelna siatka, abstrakcyjny wzór neuronowy, mocna hierarchia typografii',
      avoid: 'generycznego robota, zbyt wielu detali interfejsu, nieczytelnego mikro-tekstu, chaotycznych gradientów',
    },
  },
  {
    id: 'fitness-cover',
    label: 'Okładka planu fitness',
    description: 'Dynamiczna okładka do planu treningowego lub wyzwania.',
    templateId: 'courseCover',
    language: 'pl',
    form: {
      mainText: '30 DNI DO FORMY',
      subtitle: 'Plan treningowy dla zapracowanych',
      offer: 'PDF + kalendarz + lista zakupów',
      cta: '',
      audience: 'osoby pracujące, które chcą wrócić do regularnych treningów',
      style: 'energetyczna okładka ebooka fitness premium, nowoczesna estetyka marketingu sportowego, motywacyjna, ale czysta',
      colors: 'głębokie grafitowe tło, limonkowe akcenty, biała gruba typografia, subtelne pomarańczowe podświetlenia energii',
      format: 'pionowa okładka ebooka 2:3, duży czytelny tytuł, mocna kompozycja centralna',
      mustInclude: 'sportowa sylwetka, elementy kalendarza i checklisty, dynamiczne ukośne kształty, czytelna strefa benefitu',
      avoid: 'nierealnych proporcji ciała, zatłoczonego tła siłowni, małego tekstu planu posiłków, taniego stylu stockowego',
    },
  },
  {
    id: 'finance-mockup',
    label: 'Mockup pudełka premium',
    description: 'Pudełko 3D z frontem i grzbietem do produktu cyfrowego.',
    templateId: 'ebookMockup',
    language: 'pl',
    form: {
      mainText: 'JAK ZACZĄĆ INWESTOWAĆ',
      subtitle: '2 ŚCIEŻKI I 3 GOTOWE PLANY',
      offer: '200 zł | 500 zł | 1000 zł',
      cta: '',
      audience: 'osoby, które chcą zacząć inwestować małymi kwotami',
      style: 'realistyczny mockup pudełka ebooka premium, ciemna kinowa estetyka finansowa, render produktu edukacyjnego wysokiej klasy',
      colors: 'głęboka czarna okładka, mocne czerwone akcenty, biała gruba typografia, subtelne świecące czerwone elementy wykresu',
      format: 'pionowe ujęcie produktu, pudełko ebooka stojące pionowo, widoczny front i grzbiet w perspektywie',
      mustInclude: 'wykresy świecowe, tło z wykresem rynku, realistyczne cienie, światło studyjne, delikatne błyszczące odbicia, tytuł na grzbiecie',
      avoid: 'płaskiej okładki 2D, nieczytelnego grzbietu, błędnych polskich znaków, losowego dodatkowego tekstu, zniekształconej perspektywy pudełka',
    },
  },
  {
    id: 'webinar-ad',
    label: 'Reklama webinaru AI',
    description: 'Kwadratowa reklama z mocnym hookiem i CTA.',
    templateId: 'ad',
    language: 'pl',
    form: {
      mainText: 'AI może tworzyć reklamy za Ciebie',
      subtitle: 'Warsztat live dla przedsiębiorców',
      offer: '60 minut praktyki + gotowe prompty',
      cta: 'Zarezerwuj miejsce',
      audience: 'właściciele firm, freelancerzy i marketerzy',
      style: 'mocny nowoczesny styl polskiej reklamy w mediach społecznościowych, wysoki kontrast, estetyka premium marketingu cyfrowego',
      colors: 'głębokie bordowe tło, neonowe limonkowe akcenty, biała gruba typografia, czarno-biały przycisk CTA',
      format: 'kwadratowa reklama do mediów społecznościowych 1:1, układ czytelny na telefonie, bezpieczne marginesy dla całego tekstu',
      mustInclude: 'portret eksperta po prawej, karteczki z 3 punktami programu, duży nagłówek po lewej, czytelny przycisk CTA',
      avoid: 'małego tekstu, generycznych osób stockowych, chaotycznych naklejek, słabego kontrastu, literówek w polskich słowach',
    },
  },
  {
    id: 'carousel-cover',
    label: 'Post edukacyjny 4:5',
    description: 'Okładka posta lub karuzeli z krótką listą błędów/porad.',
    templateId: 'socialPost',
    language: 'pl',
    form: {
      mainText: '5 błędów w reklamach AI',
      subtitle: 'Sprawdź, zanim przepalisz budżet',
      offer: 'Krótki edukacyjny post z checklistą dla marketerów',
      cta: 'Zapisz na później',
      audience: 'marketerzy, właściciele firm i twórcy reklam',
      style: 'edytorska okładka karuzeli w mediach społecznościowych, wyraźna hierarchia, nowoczesny projekt marketingowy, czysty układ edukacyjny',
      colors: 'ciepłe białe tło, czarna typografia, czerwone etykiety akcentowe, subtelna papierowa tekstura, małe niebieskie wyróżnienia',
      format: 'okładka posta Instagram 4:5, czytelność na telefonie, bezpieczne marginesy, centralny nagłówek',
      mustInclude: 'numerowane elementy wizualne, czyste pole nagłówka, proste akcenty ikon, klimat checklisty, mocna kompozycja pierwszego slajdu',
      avoid: 'zbyt dużej ilości tekstu, dekoracyjnego bałaganu, nieczytelnych małych etykiet, losowego fałszywego interfejsu',
    },
  },
  {
    id: 'sales-banner',
    label: 'Baner pakietu promptów',
    description: 'Szeroki baner na stronę lub reklamę sprzedażową.',
    templateId: 'banner',
    language: 'pl',
    form: {
      mainText: 'Nowy pakiet promptów AI',
      subtitle: 'Gotowe schematy do reklam, mockupów i mediów społecznościowych',
      offer: 'Pakiet startowy dla firm i twórców online',
      cta: 'Pobierz teraz',
      audience: 'osoby, które tworzą grafiki marketingowe z AI',
      style: 'nowoczesny baner www nastawiony na konwersję, czysty układ sprzedażowy, estetyka premium narzędzi dla twórców',
      colors: 'ciemna granatowa baza, cyjanowe i magenta akcenty, biała czytelna typografia, subtelna poświata',
      format: 'szeroki poziomy baner 16:9, podgląd produktu po lewej, CTA po prawej, bezpieczne marginesy',
      mustInclude: 'czytelny przycisk CTA, wizualny podgląd kart promptów, miękka poświata, profesjonalne odstępy, prosta plakietka oferty',
      avoid: 'przeładowanego układu, słabego kontrastu, małego CTA, zbyt wielu pływających elementów',
    },
  },
  {
    id: 'youtube-ai-test',
    label: 'Miniatura testu AI',
    description: 'Mocna miniatura YouTube o narzędziu AI.',
    templateId: 'youtube',
    language: 'pl',
    form: {
      mainText: 'AI zrobiło reklamę za mnie',
      subtitle: 'Test generatora grafik',
      offer: 'Film edukacyjny z porównaniem efektów',
      cta: '',
      audience: 'osoby zainteresowane AI, marketingiem i narzędziami graficznymi',
      style: 'miniatura YouTube nastawiona na wysoki CTR, mocny kontrast, ekspresyjny komercyjny styl technologiczny',
      colors: 'czarne tło, żółte i cyjanowe akcenty, duża biała typografia, czerwone wyróżnienia strzałkami',
      format: 'miniatura YouTube 16:9, duży czytelny tekst, mocna twarz lub zbliżenie produktu',
      mustInclude: 'zaskoczona twarz twórcy, podgląd grafiki wygenerowanej AI, strzałka, wyraźne wrażenie przed i po',
      avoid: 'małego tekstu, zbyt wielu słów, generycznej twarzy stockowej, niskiego kontrastu, zatłoczonego tła',
    },
  },
  {
    id: 'ai-product-mockup',
    label: 'Mockup kursu AI premium',
    description: 'Pudelko 3D dla kursu, pakietu promptow albo produktu cyfrowego.',
    templateId: 'ebookMockup',
    language: 'pl',
    form: {
      mainText: 'AI CONTENT SYSTEM',
      subtitle: 'Gotowe prompty, checklisty i workflow',
      offer: 'Kurs + PDF + biblioteka promptow',
      cta: '',
      audience: 'tworcy online, male firmy, marketerzy i freelancerzy',
      style: 'realistyczny mockup pudełka kursu cyfrowego premium, futurystyczna estetyka marketingu AI, render produktu wysokiej klasy dla twórców',
      colors: 'głęboka grafitowa okładka, elektryczne niebieskie i fioletowe akcenty, biała gruba typografia, subtelna neonowa poświata interfejsu',
      format: 'pionowy mockup produktu 3D, widoczny front i grzbiet, wyśrodkowane ujęcie produktu, czyste studyjne tło',
      mustInclude: 'elementy panelu AI na okładce, karty promptów, subtelna siatka, błyszczące odbicia, realistyczny cień, czytelny tytuł na grzbiecie',
      avoid: 'płaskiej okładki, losowego małego tekstu, generycznej maskotki robota, zniekształconego pudełka, nieczytelnych polskich znaków',
    },
  },
  {
    id: 'ebook-beauty-cover',
    label: 'Okładka beauty / lifestyle',
    description: 'Miękka okładka dla ebooka, kursu lub poradnika premium.',
    templateId: 'courseCover',
    language: 'pl',
    form: {
      mainText: 'PLAN BEAUTY CONTENT',
      subtitle: '30 pomysłów na posty, rolki i oferty',
      offer: 'Ebook + checklisty + przykłady tekstów',
      cta: '',
      audience: 'salony beauty, stylistki, kosmetolozki i marki osobiste',
      style: 'miękka okładka ebooka beauty premium, elegancki edytorski styl lifestyle, czysta kobieca estetyka marketingowa',
      colors: 'ciepłe białe tło, pudrowe różowe akcenty, stonowane złote detale, elegancka grafitowa typografia',
      format: 'pionowa okładka ebooka 2:3, duży tytuł, miękka kompozycja skupiona na produkcie, czytelny podgląd na telefonie',
      mustInclude: 'delikatna grafika liniowa, subtelne detale kosmetyczne, elegancka plakietka, czysta strefa podtytułu, miękkie cienie',
      avoid: 'taniego wrażenia zdjęcia stockowego, kosmetycznego bałaganu, agresywnych kolorów, nieczytelnego małego tekstu',
    },
  },
  {
    id: 'local-service-ad',
    label: 'Reklama usługi lokalnej',
    description: 'Gotowy start dla salonu, konsultacji, gabinetu lub lokalnej oferty.',
    templateId: 'ad',
    language: 'pl',
    form: {
      mainText: 'Zdobądź więcej klientów z AI',
      subtitle: 'Konsultacja marketingowa dla lokalnych firm',
      offer: 'Audyt profilu + 10 pomysłów na reklamy',
      cta: 'Umów konsultację',
      audience: 'właściciele lokalnych firm, usługodawcy i specjaliści',
      style: 'nowoczesna reklama usługi lokalnej nastawiona na konwersję, projekt sprzedażowy premium, ale przystępny, mocna hierarchia nagłówka',
      colors: 'czysta biała baza, czarna typografia, elektryczne niebieskie akcenty, ciepły pomarańczowy przycisk CTA',
      format: 'kwadratowa reklama do mediów społecznościowych 1:1, czytelność na telefonie, wyraźne CTA, bezpieczne marginesy tekstu',
      mustInclude: 'przyjazny portret eksperta, prosty efekt marketingowy przed i po, trzy punkty benefitów, mocny przycisk CTA',
      avoid: 'korporacyjnego stockowego wyglądu, małego tekstu punktów, zbyt wielu ikon, fałszywego nieczytelnego interfejsu',
    },
  },
  {
    id: 'product-launch-ad',
    label: 'Premiera produktu',
    description: 'Mocna kreacja sprzedażowa pod launch, promocję lub nową ofertę.',
    templateId: 'ad',
    language: 'pl',
    form: {
      mainText: 'Nowy pakiet promptów AI',
      subtitle: 'Twórz grafiki szybciej i bez pustej kartki',
      offer: '50 gotowych promptów do reklam, okładek i mockupów',
      cta: 'Sprawdź pakiet',
      audience: 'osoby tworzące grafiki marketingowe i treści online',
      style: 'mocna grafika reklamowa na premierę produktu, układ reakcji bezpośredniej, estetyka premium dla twórców i produktów cyfrowych',
      colors: 'ciemne tło, neonowe limonkowe i magenta akcenty, biała gruba typografia, CTA o wysokim kontraście',
      format: 'kwadratowa reklama premiery 1:1 do mediów społecznościowych, wyśrodkowany podgląd produktu, czytelny nagłówek i CTA',
      mustInclude: 'karty produktu lub podgląd pakietu cyfrowego, plakietka premiery, mocny przycisk CTA, subtelna poświata, czysta hierarchia benefitów',
      avoid: 'bałaganu kolażu, słabej oferty, małego CTA, losowego tekstu, taniego wyglądu szablonu',
    },
  },
  {
    id: 'checklist-cover',
    label: 'Okładka checklisty',
    description: 'Czytelna okładka PDF pod lead magnet, checklistę albo mini poradnik.',
    templateId: 'courseCover',
    language: 'pl',
    form: {
      mainText: 'CHECKLISTA REKLAM AI',
      subtitle: '12 punktów przed publikacją kreacji',
      offer: 'PDF do pobrania + przykłady dobrych promptów',
      cta: '',
      audience: 'marketerzy, twórcy online i właściciele małych firm',
      style: 'czysta okładka lead magnetu premium, nowoczesny projekt checklisty, wiarygodna edukacyjna estetyka marketingowa',
      colors: 'białe tło, czarna typografia, szmaragdowe i niebieskie akcenty, subtelna szara siatka',
      format: 'pionowa okładka PDF 2:3, mocny tytuł, podgląd checklisty, czysta dolna strefa benefitu',
      mustInclude: 'elementy checkboxów, proste akcenty ikon AI, uporządkowany podgląd listy numerowanej, mocna hierarchia tytułu',
      avoid: 'zbyt wielu punktów listy, słabego kontrastu, generycznego zdjęcia clipboardu, małego tekstu',
    },
  },
  {
    id: 'sales-carousel-post',
    label: 'Post sprzedażowy 4:5',
    description: 'Pierwszy slajd karuzeli, który od razu pokazuje problem i ofertę.',
    templateId: 'socialPost',
    language: 'pl',
    form: {
      mainText: 'Twoje reklamy wyglądają jak z szablonu?',
      subtitle: 'Zobacz, jak AI może zrobić lepszą kreację',
      offer: 'Generator promptów + gotowe przykłady',
      cta: 'Zapisz i przetestuj',
      audience: 'twórcy reklam, małe firmy i freelancerzy',
      style: 'mocna edukacyjna okładka karuzeli sprzedażowej, nowoczesny polski styl mediów społecznościowych, czytelny układ problem-rozwiązanie',
      colors: 'grafitowe tło, biała typografia, neonowe limonkowe wyróżnienia, małe czerwone akcenty ostrzegawcze',
      format: 'okładka karuzeli Instagram 4:5, duży nagłówek, tekst czytelny na telefonie, bezpieczne marginesy',
      mustInclude: 'etykieta problemu, prosta grafika porównawcza, wyróżniony blok rozwiązania, czytelne CTA na dole',
      avoid: 'zbyt wielu słów, bałaganu, małych podpisów, losowych dekoracyjnych naklejek',
    },
  },
  {
    id: 'webinar-banner',
    label: 'Baner webinaru',
    description: 'Szeroki baner na landing page albo reklamę wydarzenia online.',
    templateId: 'banner',
    language: 'pl',
    form: {
      mainText: 'Warsztat AI dla firm',
      subtitle: 'Twórz reklamy, banery i okładki w kilka minut',
      offer: 'Live + nagranie + pakiet promptów',
      cta: 'Zarezerwuj miejsce',
      audience: 'przedsiębiorcy, marketerzy i twórcy online',
      style: 'baner landing page webinaru premium, nowoczesna estetyka edukacji technologicznej, układ nastawiony na konwersję',
      colors: 'głębokie granatowe tło, cyjanowe i limonkowe akcenty, biała typografia, jasny przycisk CTA',
      format: 'szeroki poziomy baner www 16:9, nagłówek po lewej, prowadzący lub podgląd produktu po prawej',
      mustInclude: 'plakietka daty webinaru, miejsce na portret prowadzącego, trzy punkty benefitów, mocny przycisk CTA, czyste odstępy',
      avoid: 'zatłoczonego kolażu webinarowego, małego tekstu daty, niskiego kontrastu, zbyt wielu plakietek',
    },
  },
  {
    id: 'comparison-thumbnail',
    label: 'Miniatura porównania',
    description: 'Miniatura YouTube pod test modeli, narzędzi lub efektów przed/po.',
    templateId: 'youtube',
    language: 'pl',
    form: {
      mainText: 'GEMINI czy OPENAI?',
      subtitle: 'Test grafik z tekstem',
      offer: 'Porównanie modeli AI do reklam',
      cta: '',
      audience: 'osoby testujące narzędzia AI do grafiki i marketingu',
      style: 'miniatura YouTube porównania nastawiona na wysoki CTR, mocny styl recenzji technologicznej, ekspresyjna kompozycja podzielonego ekranu',
      colors: 'czarne tło, strona cyjanowa kontra strona magenta, żółte etykiety akcentowe, biała gruba typografia',
      format: 'miniatura YouTube 16:9, porównanie na podzielonym ekranie, ogromny czytelny tekst, mocna twarz lub podgląd produktu',
      mustInclude: 'dwa podglądy wyników modeli, symbol kontra, zaskoczona twarz, wyróżnienia strzałkami, zostawione czyste miejsce na zwycięzcę',
      avoid: 'małych screenshotów, zbyt wielu słów, fałszywych nieczytelnych wykresów, słabego kontrastu',
    },
  },
];

const outputLanguages: Array<{ id: OutputLanguage; label: string }> = [
  { id: 'pl', label: 'Polski' },
];

const emptyForm: PromptForm = {
  mainText: '',
  subtitle: '',
  offer: '',
  cta: '',
  audience: '',
  style: '',
  colors: '',
  format: '',
  mustInclude: '',
  avoid: '',
};

const clean = (value: string, fallback: string) => value.trim() || fallback;

const quoted = (value: string) => `"${value.trim()}"`;

const buildStructuredPrompt = (template: TemplateConfig, form: PromptForm, language: OutputLanguage) => {
  const mainText = clean(form.mainText, template.defaults.mainText);
  const subtitle = clean(form.subtitle, template.defaults.subtitle);
  const offer = clean(form.offer, template.defaults.offer);
  const cta = clean(form.cta, template.defaults.cta);
  const audience = clean(form.audience, template.defaults.audience);
  const style = clean(form.style, template.defaults.style);
  const colors = clean(form.colors, template.defaults.colors);
  const format = clean(form.format, template.defaults.format);
  const mustInclude = clean(form.mustInclude, template.defaults.mustInclude);
  const avoid = clean(form.avoid, template.defaults.avoid);

  if (language === 'pl') {
    return [
      `Stwórz profesjonalną grafikę typu: ${template.label}.`,
      '',
      'CEL GRAFIKI:',
      `Grafika ma przyciągać uwagę, jasno pokazywać ofertę i wyglądać jak gotowy materiał do publikacji.`,
      '',
      'GŁÓWNY TEKST:',
      quoted(mainText),
      '',
      'PODTYTUŁ / BENEFIT:',
      quoted(subtitle),
      '',
      'OFERTA / PRODUKT:',
      offer,
      cta ? ['', 'CTA:', quoted(cta)] : '',
      '',
      'ODBIORCA:',
      audience,
      '',
      'STYL:',
      style,
      '',
      'KOLORY:',
      colors,
      '',
      'KOMPOZYCJA:',
      mustInclude,
      '',
      'FORMAT:',
      format,
      '',
      'ZASADY TEKSTU:',
      'Zachowaj polskie znaki dokładnie tak, jak podano. Nie dodawaj losowych napisów. Tekst ma być duży, czytelny i bez literówek.',
      '',
      'UNIKAJ:',
      avoid,
      '',
      'JAKOŚĆ:',
      'wysoka jakość, profesjonalny układ, czytelna hierarchia, realistyczne światło, gotowe do użycia w marketingu',
    ]
      .flat()
      .filter(Boolean)
      .join('\n');
  }

  const intro =
    template.id === 'ebookMockup'
      ? 'Create a realistic premium ebook box / digital product mockup standing in 3D perspective.'
      : `Create a professional high-converting ${template.label.toLowerCase()} for marketing use.`;

  return [
    intro,
    '',
    'GOAL:',
    'The graphic should attract attention, communicate the offer clearly, and look ready for publication.',
    '',
    template.id === 'ebookMockup' ? 'EBOOK / PRODUCT TITLE:' : 'MAIN HEADLINE:',
    quoted(mainText),
    '',
    'SUBTITLE / BENEFIT:',
    quoted(subtitle),
    '',
    'OFFER / PRODUCT:',
    offer,
    cta ? ['', 'CTA:', quoted(cta)] : '',
    '',
    'TARGET AUDIENCE:',
    audience,
    '',
    'STYLE:',
    style,
    '',
    'COLORS:',
    colors,
    '',
    template.id === 'ebookMockup' ? 'COVER AND MOCKUP DETAILS:' : 'COMPOSITION:',
    mustInclude,
    '',
    'FORMAT:',
    format,
    '',
    'TEXT RULES:',
    'Keep all Polish characters exactly as written. Do not invent extra text. Use large readable typography with correct spelling.',
    '',
    'AVOID:',
    avoid,
    '',
    'QUALITY:',
    'high detail, clean hierarchy, advertising quality, professional layout, polished lighting, modern commercial design',
  ]
    .flat()
    .filter(Boolean)
    .join('\n');
};

const improvePrompt = (rawPrompt: string, template: TemplateConfig, form: PromptForm, language: OutputLanguage) => {
  const base = rawPrompt.trim();
  const structured = buildStructuredPrompt(template, form, language);

  if (!base) return structured;

  if (language === 'pl') {
    return [
      'Przepisz poniższy pomysł na kompletny prompt do generatora grafik AI.',
      '',
      'POMYSŁ UŻYTKOWNIKA:',
      base,
      '',
      'ULEPSZONA WERSJA PROMPTU:',
      structured,
      '',
      'DODATKOWE ZASADY:',
      'Zachowaj sens oryginalnego pomysłu, ale uporządkuj kompozycję, styl, tekst, format i jakość wykonania.',
    ].join('\n');
  }

  return [
    'Rewrite the user idea below into a complete image-generation prompt.',
    '',
    'USER IDEA:',
    base,
    '',
    'IMPROVED PROMPT:',
    structured,
    '',
    'EXTRA RULES:',
    'Preserve the intent of the original idea, but improve composition, visual style, text hierarchy, format, and production quality.',
  ].join('\n');
};

const getPromptScore = (form: PromptForm, resultPrompt: string) => {
  const missing: string[] = [];
  if (!form.mainText.trim()) missing.push('Dodaj główny tekst lub tytuł.');
  if (!form.offer.trim()) missing.push('Dopisz produkt, ofertę albo kontekst grafiki.');
  if (!form.style.trim()) missing.push('Określ styl wizualny.');
  if (!form.colors.trim()) missing.push('Dodaj kolorystykę lub klimat marki.');
  if (!form.format.trim()) missing.push('Wskaż format publikacji, np. 1:1, 4:5, 16:9.');

  const textLength = `${form.mainText} ${form.subtitle} ${form.cta}`.trim().length;
  const warnings: string[] = [];
  if (textLength > 140) warnings.push('Na grafice jest dużo tekstu. Rozważ skrócenie nagłówka lub podtytułu.');
  if (!form.avoid.trim()) warnings.push('Warto dopisać, czego model ma unikać.');
  if (resultPrompt.length > 2500) warnings.push('Prompt jest bardzo długi. Przy prostych grafikach możesz skrócić sekcję stylu.');

  const score = Math.max(35, 100 - missing.length * 12 - warnings.length * 5);
  const label = score >= 85 ? 'Bardzo dobry' : score >= 70 ? 'Dobry' : score >= 55 ? 'Do poprawy' : 'Za mało danych';

  return { score, label, missing, warnings };
};

const PromptGeneratorPro = () => {
  const [mode, setMode] = useState<PromptMode>('builder');
  const [templateId, setTemplateId] = useState<TemplateId>('ad');
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('pl');
  const [form, setForm] = useState<PromptForm>(templates[0].defaults);
  const [rawPrompt, setRawPrompt] = useState('');
  const [touched, setTouched] = useState(false);


  useEffect(() => {
    const seedPrompt =
      window.sessionStorage.getItem('promptGeneratorProSeedPrompt') ||
      window.localStorage.getItem('promptGeneratorProSeedPrompt');
    if (!seedPrompt) return;

    setMode('improve');
    setRawPrompt(seedPrompt);
    setTouched(true);
    window.sessionStorage.removeItem('promptGeneratorProSeedPrompt');
    window.localStorage.removeItem('promptGeneratorProSeedPrompt');
    toast.success('Prompt z galerii został wstawiony do remiksu');
  }, []);

  const selectedTemplate = templates.find((template) => template.id === templateId) || templates[0];
  const selectedStylePresets = useMemo(
    () => stylePresets.filter((preset) => preset.templateIds.includes(templateId)),
    [templateId]
  );
  const selectedExamples = useMemo(
    () => promptExamples.filter((example) => example.templateId === templateId),
    [templateId]
  );

  const resultPrompt = useMemo(() => {
    if (mode === 'improve') {
      return improvePrompt(rawPrompt, selectedTemplate, form, outputLanguage);
    }

    return buildStructuredPrompt(selectedTemplate, form, outputLanguage);
  }, [form, mode, outputLanguage, rawPrompt, selectedTemplate]);

  const quality = useMemo(() => getPromptScore(form, resultPrompt), [form, resultPrompt]);

  const updateField = (field: keyof PromptForm, value: string) => {
    setTouched(true);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const applyStylePreset = (preset: StylePreset) => {
    setTouched(true);
    setForm((previous) => ({ ...previous, ...preset.fields }));
    toast.success(`Styl "${preset.label}" został zastosowany`);
  };

  const applyExample = (example: PromptExample) => {
    setMode('builder');
    setTemplateId(example.templateId);
    setOutputLanguage(example.language || outputLanguage);
    setForm(example.form);
    setRawPrompt('');
    setTouched(true);
    toast.success(`Użyto szablonu: ${example.label}`);
  };

  const selectTemplate = (nextTemplate: TemplateConfig) => {
    setTemplateId(nextTemplate.id);
    setForm(nextTemplate.defaults);
    setTouched(false);
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(resultPrompt);
    toast.success('Prompt skopiowany');
  };

  const useInGenerator = () => {
    window.sessionStorage.setItem('promptGeneratorProPrompt', resultPrompt);
    toast.success('Prompt przeniesiony do generatora');
  };

  const downloadPrompt = () => {
    const blob = new Blob([resultPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prompt-pro-${selectedTemplate.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start gap-3">
          <Link to="/tools">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <Badge variant="outline" className="mb-2 rounded-full px-3 py-1 text-xs">
              Darmowe narzędzie
            </Badge>
            <h1 className="text-3xl font-bold">
              <Wand2 className="mr-2 inline h-6 w-6 text-primary" />
              Generator Promptów <span className="gradient-text">Pro</span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Zbuduj gotowy prompt do reklamy, mockupu, okładki, posta, banera albo miniatury bez zużywania kredytów.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-5 pt-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mode === 'builder' ? 'default' : 'outline'}
                    className={mode === 'builder' ? 'gradient-bg' : ''}
                    onClick={() => setMode('builder')}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Kreator promptu
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'improve' ? 'default' : 'outline'}
                    className={mode === 'improve' ? 'gradient-bg' : ''}
                    onClick={() => setMode('improve')}
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Popraw mój prompt
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {templates.map((template) => {
                    const Icon = template.icon;
                    const selected = template.id === templateId;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => selectTemplate(template)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          selected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-background hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="font-semibold">{template.shortLabel}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{template.description}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedExamples.length > 0 && (
                  <div className="space-y-3 border-t pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">Szablony startowe</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Wybierz gotowy brief, a formularz uzupełni tytuł, ofertę, odbiorcę, styl, kolory i format.
                        </p>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        1 klik
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedExamples.map((example) => (
                        <button
                          key={example.id}
                          type="button"
                          onClick={() => applyExample(example)}
                          className="rounded-xl border bg-muted/20 p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{example.label}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{example.description}</p>
                          <span className="mt-3 inline-flex rounded-full bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            Użyj szablonu
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStylePresets.length > 0 && (
                  <div className="space-y-3 border-t pt-5">
                    <div>
                      <h2 className="text-base font-semibold">
                        {templateId === 'courseCover' || templateId === 'ebookMockup'
                          ? 'Style okładek i mockupów'
                          : 'Style kreacji'}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Kliknij styl, żeby od razu podmienić estetykę, kolory i elementy kompozycji.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedStylePresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyStylePreset(preset)}
                          className="rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{preset.label}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {mode === 'improve' && (
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Wklej swój obecny prompt</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Narzędzie zachowa pomysł, ale dopisze strukturę, format, styl i zasady tekstu.
                    </p>
                  </div>
                  <Textarea
                    value={rawPrompt}
                    onChange={(event) => setRawPrompt(event.target.value)}
                    placeholder="Np. zrób reklamę kursu AI z człowiekiem i dużym napisem..."
                    className="min-h-[150px]"
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Główny tekst / tytuł</label>
                    <Input value={form.mainText} onChange={(event) => updateField('mainText', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Podtytuł / benefit</label>
                    <Input value={form.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Oferta / produkt</label>
                    <Input value={form.offer} onChange={(event) => updateField('offer', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CTA</label>
                    <Input value={form.cta} onChange={(event) => updateField('cta', event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Odbiorca</label>
                    <Input value={form.audience} onChange={(event) => updateField('audience', event.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Styl</label>
                    <Textarea
                      value={form.style}
                      onChange={(event) => updateField('style', event.target.value)}
                      className="min-h-[96px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kolory</label>
                    <Textarea
                      value={form.colors}
                      onChange={(event) => updateField('colors', event.target.value)}
                      className="min-h-[96px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Format</label>
                    <Textarea
                      value={form.format}
                      onChange={(event) => updateField('format', event.target.value)}
                      className="min-h-[96px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Elementy obowiązkowe</label>
                    <Textarea
                      value={form.mustInclude}
                      onChange={(event) => updateField('mustInclude', event.target.value)}
                      className="min-h-[96px]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Czego unikać</label>
                    <Textarea
                      value={form.avoid}
                      onChange={(event) => updateField('avoid', event.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {outputLanguages.map((language) => (
                      <Button
                        key={language.id}
                        type="button"
                        variant={outputLanguage === language.id ? 'default' : 'outline'}
                        size="sm"
                        className={outputLanguage === language.id ? 'gradient-bg' : ''}
                        onClick={() => setOutputLanguage(language.id)}
                      >
                        {language.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm(selectedTemplate.defaults);
                      setTouched(false);
                    }}
                  >
                    Przywróć przykład
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Gotowy prompt</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedTemplate.label} - {outputLanguage === 'en' ? 'prompt po angielsku' : 'prompt po polsku'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 rounded-full">
                    {resultPrompt.length} znaków
                  </Badge>
                </div>

                <Textarea
                  value={resultPrompt}
                  readOnly
                  className="min-h-[420px] resize-none whitespace-pre-wrap text-sm leading-6"
                />

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={copyPrompt} className="gap-2">
                    <Copy className="h-4 w-4" />
                    Kopiuj prompt
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadPrompt}>
                    Pobierz TXT
                  </Button>
                </div>

                <Button asChild variant="outline" className="w-full gap-2" onClick={useInGenerator}>
                  <Link to="/generator">
                    Użyj w generatorze
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-emerald-600" />
                    <h2 className="font-semibold">Ocena promptu</h2>
                  </div>
                  <span className="text-sm font-semibold">{quality.score}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500"
                    style={{ width: `${quality.score}%` }}
                  />
                </div>
                <Badge variant={quality.score >= 70 ? 'default' : 'secondary'} className="rounded-full">
                  {quality.label}
                </Badge>

                {(quality.missing.length > 0 || quality.warnings.length > 0) && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {[...quality.missing, ...quality.warnings].map((item) => (
                      <p key={item} className="rounded-lg border bg-muted/20 px-3 py-2">
                        {item}
                      </p>
                    ))}
                  </div>
                )}

                {quality.missing.length === 0 && quality.warnings.length === 0 && (
                  <p className="rounded-lg border bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                    Prompt ma kompletne dane: tekst, ofertę, styl, kolory, format i ograniczenia.
                  </p>
                )}

                {!touched && (
                  <p className="text-xs text-muted-foreground">
                    Startujesz od przykładu. Podmień teksty na swoje, żeby prompt pasował do Twojej oferty.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default PromptGeneratorPro;
