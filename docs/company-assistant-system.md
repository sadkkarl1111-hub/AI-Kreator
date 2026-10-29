# System firmowy / Asystent materiałów dla firmy

Stan na: 2026-07-04  
Główne pliki:

- `src/pages/CompanyAssistant.tsx`
- `src/pages/Generator.tsx`
- `src/App.tsx`
- `src/components/AppLayout.tsx`
- `src/pages/Dashboard.tsx`
- `vps/server/src/routes/me.ts`
- `vps/server/src/lib/localCompanyAssistantData.ts`
- `vps/server/src/lib/postgres.ts`

## 1. Cel systemu

Asystent firmowy ma prowadzić użytkownika przez przygotowanie profilu marki/firmy, a następnie wygenerować osobne prompty do materiałów typu:

- wizytówka,
- mini brandbook,
- ulotka/oferta,
- post Instagram,
- baner reklamowy,
- pakiet startowy firmy,
- mapa niszy,
- wizualizacja konceptu marki.

System nie generuje grafiki bezpośrednio w tym widoku. Tworzy prompty i przenosi wybrany prompt do głównego generatora grafik.

## 2. Dostęp

Aktualnie funkcja jest dostępna tylko dla administratora.

Frontend:

- trasa: `/company-assistant`
- komponent: `CompanyAssistant`
- ochrona trasy: `AdminOnlyRoute` w `src/App.tsx`
- pozycja menu: `Firma` w `src/components/AppLayout.tsx`
- kafelek na dashboardzie: `Asystent firmy` w `src/pages/Dashboard.tsx`

Backend nie ma osobnej blokady admin-only na endpointach pakietów. Endpointy wymagają zalogowanego użytkownika, ale nie wymagają roli admina. Dostęp admin-only jest obecnie wymuszony po stronie UI/routingu.

## 3. Aktualny przepływ użytkownika

### Krok 1: etap użytkownika

Użytkownik wybiera jeden z etapów:

1. `Mam już firmę`
2. `Dopiero zakładam`
3. `Mam tylko pomysł`
4. `Szukam niszy`

Ten wybór wpływa na:

- zestaw pytań,
- domyślne materiały,
- teksty korzyści,
- finalny prompt.

### Krok 2: branża / obszar

Użytkownik wybiera branżę z listy rozwijanej, np.:

- Firma lokalna
- Fryzjerstwo / barber
- Studio tatuażu
- Beauty / kosmetologia
- Gastronomia
- E-commerce
- Social media
- Nieruchomości
- Sport / magazyn
- Usługi eksperckie
- Inne

Jeżeli wybierze `Inne`, pojawia się pole tekstowe. Wpis z tego pola jest przepisywany do `industry` i `nicheInterests`, żeby stare wartości z localStorage, np. `Nieruchomości`, nie wpływały na dalszą analizę.

Problem do dalszego dopracowania: obecnie to nadal jest logika formularzowa i heurystyczna, nie faktyczna analiza AI po wpisanym tekście.

### Kolejne kroki: pytania profilowe

Pytania zależą od etapu. Profil może zawierać m.in.:

- nazwa firmy,
- branża,
- pomysł biznesowy,
- oferta,
- główny produkt/usługa,
- wyróżnik,
- klient docelowy,
- problem klienta,
- lokalizacja,
- strona www,
- Instagram,
- telefon,
- e-mail,
- styl marki,
- kolory,
- logo/pomysł na symbol,
- ton komunikacji,
- CTA,
- notatki do druku,
- czego unikać.

Pytania `industry` i `nicheInterests` są obecnie filtrowane z kolejnych kroków, bo branża jest wybierana wcześniej w osobnym kroku.

### Krok: styl wizualny

Użytkownik wybiera gotowy kierunek wizualny lub wpisuje własne kolory.

Aktualne presety stylów:

- Premium Black & Gold
- Minimal White
- Luxury Real Estate
- Bold Agency
- Local Friendly
- Clean Beauty / Medical
- Tattoo Dark Ink
- Street Neon
- Sport Stadium
- Pastel Beauty
- Eco Organic
- Tech Blue
- Food Warm
- Kids Playful
- Editorial Magazine
- Creative Gradient
- Mono Luxury

Pole `Własne kolory marki` obsługuje wpisy tekstowe albo HEX, np.:

- `czarny, czerwony, srebrny`
- `#111111, #c1121f, #f8f9fa`

Własne kolory mają priorytet w promptach nad presetem. Preset nadal steruje klimatem, kompozycją i stylem.

### Krok: wybór materiałów

Użytkownik wybiera kilka materiałów. Każdy materiał dostaje osobny prompt.

Materiały są filtrowane zależnie od etapu użytkownika:

- `existing`
- `starting`
- `idea`
- `exploring`

### Krok: podgląd

System pokazuje prosty podgląd kart materiałów.

Podgląd:

- używa presetowych kolorów,
- używa własnych HEX-ów, jeśli użytkownik je poda,
- pokazuje nazwę marki,
- pokazuje headline,
- pokazuje CTA,
- pokazuje format materiału.

To nie jest render finalnej grafiki. To tylko szybka wizualna kontrola kierunku.

### Krok: finalne prompty

System buduje osobny prompt dla każdego wybranego materiału.

Użytkownik może:

- skopiować prompt,
- zapisać pakiet promptów,
- przejść z wybranym promptem do generatora.

## 4. Jak działa przeniesienie do generatora

Po kliknięciu `Przejdź do generatora` system zapisuje do `localStorage`:

- `companyAssistantPrompt`
- `companyAssistantFormat`
- `companyAssistantStyle`

Następnie przechodzi do `/generator`.

`src/pages/Generator.tsx` wczytuje te wartości, ustawia prompt, format i styl, a potem usuwa je z localStorage.

To jest rozwiązanie proste, ale kruche. Przy mocniejszej rozbudowie lepsze będzie przekazywanie przez:

- ID zapisanego pakietu,
- ID konkretnego materiału,
- backendowy endpoint `GET /me/company-assistant-packages/:id`,
- ewentualnie dedykowaną tabelę `company_assistant_materials`.

## 5. Zapisywanie danych

### LocalStorage

Frontend używa:

- `companyAssistantProfile`
- `companyAssistantSavedPackages`

LocalStorage jest używany jako szybki zapis profilu i fallback, gdy zapis na koncie nie zadziała.

Problem: localStorage powodował już błędy ze starym kontekstem, np. użytkownik wpisuje `studio tatuażu`, a w profilu dalej zostaje `Nieruchomości`.

### Backend / PostgreSQL

Endpointy:

- `GET /me/company-assistant-packages?limit=20`
- `POST /me/company-assistant-packages`

Tabela:

```sql
CREATE TABLE IF NOT EXISTS company_assistant_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Indeks:

```sql
CREATE INDEX IF NOT EXISTS company_assistant_packages_user_idx
  ON company_assistant_packages (user_id, created_at DESC);
```

Aktualnie zapisujemy cały profil jako JSONB i tablicę promptów jako JSONB.

## 6. Jak budowany jest prompt

Prompt jest tworzony funkcją `buildMaterialPrompt`.

Składa się z:

1. celu materiału, np. `Create a premium double-sided business card design`
2. typu materiału,
3. formatu,
4. profilu firmy,
5. struktury materiału,
6. reguł designu.

W profilu firmy trafiają m.in.:

- etap biznesu,
- wybrany preset wizualny,
- custom area,
- nazwa,
- branża,
- pomysł,
- oferta,
- klient,
- problem,
- styl,
- kolory,
- CTA,
- czego unikać.

Jeśli użytkownik poda własne kolory, prompt dodaje regułę:

```text
IMPORTANT: use these user-provided brand colors as priority...
```

## 7. Obecne problemy

### 7.1 Za dużo logiki w jednym komponencie

`CompanyAssistant.tsx` ma ponad 2000 linii i trzyma:

- typy,
- dane formularza,
- presety,
- pytania,
- materiały,
- heurystyki,
- zapis,
- UI,
- preview,
- budowę promptu.

To utrudnia dalszą rozbudowę i zwiększa ryzyko regresji.

### 7.2 Heurystyki zamiast realnej analizy AI

System mówi o analizie, ale obecnie większość decyzji to proste warunki tekstowe:

- czy tekst zawiera `nieruch`,
- czy zawiera `social`,
- czy zawiera `sport`,
- itd.

Dla realnej jakości powinien powstać osobny krok `Interpretacja briefu`, gdzie backend/AI zwraca strukturę:

```ts
{
  detectedIndustry: string;
  businessType: string;
  targetAudience: string;
  offerHypothesis: string;
  recommendedMaterials: string[];
  recommendedVisualStyles: string[];
  missingQuestions: string[];
}
```

### 7.3 Problem starych danych

localStorage może trzymać stary profil. To powodowało sytuacje:

- użytkownik wpisuje nową branżę,
- ale stare `industry` / `nicheInterests` nadal wpływa na prompt.

Potrzebna jest lepsza separacja:

- nowy projekt,
- zapisany profil marki,
- zapisane pakiety,
- wersje briefu.

### 7.4 Brak prawdziwego panelu firm

Aktualnie zapisane pakiety są widoczne na końcu kreatora, ale nie ma pełnego panelu:

- lista firm/projektów,
- podgląd profilu firmy,
- historia promptów,
- historia wygenerowanych grafik,
- edycja brandbooka,
- ponowne użycie marki,
- duplikowanie projektu,
- archiwizacja.

### 7.5 Brak rozdzielenia brandbooka od promptów

Brandbook powinien być osobnym obiektem danych, nie tylko promptem do grafiki.

Powinien zawierać:

- paletę kolorów,
- fonty,
- styl zdjęć,
- ton komunikacji,
- zasady logo,
- CTA,
- słowa zakazane,
- przykłady materiałów,
- opis klienta,
- opis oferty.

### 7.6 Brak kontroli jakości promptów

Prompt jest generowany statycznie z szablonu. Nie ma walidacji:

- czy ma klienta,
- czy ma ofertę,
- czy ma CTA,
- czy ma format,
- czy nie ma sprzecznych branż,
- czy kolory są czytelne.

### 7.7 Brak dedykowanych szablonów wizualnych

Presety są tekstowe i kolorystyczne. Nie ma jeszcze prawdziwych szablonów layoutu, np.:

- wizytówka minimalistyczna,
- wizytówka premium,
- post z dużym nagłówkiem,
- post oferta + CTA,
- brandbook plansza,
- moodboard,
- karta usługi,
- cennik,
- voucher,
- menu,
- portfolio,
- baner rekrutacyjny.

## 8. Proponowana docelowa architektura

### 8.1 Rozdzielenie modułów frontendu

Proponowany podział:

```text
src/features/company-assistant/
  CompanyAssistantPage.tsx
  types.ts
  constants/
    stages.ts
    areas.ts
    questions.ts
    materials.ts
    visualThemes.ts
  logic/
    buildMaterialPrompt.ts
    analyzeBriefLocally.ts
    normalizeProfile.ts
    validateBrief.ts
  components/
    StageStep.tsx
    AreaStep.tsx
    QuestionStep.tsx
    VisualStyleStep.tsx
    MaterialsStep.tsx
    PromptSummary.tsx
    MaterialPreview.tsx
```

### 8.2 Backendowa analiza briefu

Nowy endpoint:

```http
POST /api/company-assistant/analyze-brief
```

Input:

```json
{
  "stage": "idea",
  "area": "Studio tatuażu",
  "answers": {}
}
```

Output:

```json
{
  "detectedIndustry": "Studio tatuażu",
  "businessType": "local premium service",
  "targetAudience": "osoby 18-40 szukające autorskich tatuaży",
  "recommendedQuestions": [],
  "recommendedMaterials": ["brandbook", "instagram-post", "business-card"],
  "recommendedThemes": ["tattoo-dark-ink", "editorial-magazine"],
  "warnings": []
}
```

### 8.3 Projekty firmowe

Nowe tabele:

```sql
company_projects
company_brandbooks
company_material_prompts
company_generated_assets
```

Wtedy pakiet nie jest tylko jednorazowym JSON-em. Użytkownik ma trwały projekt firmy.

### 8.4 Powiązanie wygenerowanych grafik z firmą

Aktualnie grafiki zapisują się w galerii, ale nie są przypięte do pakietu/firmy.

Docelowo przy generowaniu z promptu firmowego generator powinien dostać:

- `companyProjectId`,
- `materialPromptId`,
- `materialType`.

Wtedy galeria może pokazać:

- grafiki dla konkretnej firmy,
- grafiki dla konkretnego materiału,
- wersje i poprawki.

## 9. Priorytet poprawek

### Etap 1: stabilizacja obecnego kreatora

1. Rozbić `CompanyAssistant.tsx` na mniejsze pliki.
2. Usunąć konflikty localStorage.
3. Dodać przycisk `Nowy projekt / wyczyść brief`.
4. Dodać walidację sprzecznych pól, np. `industry = studio tatuażu`, ale `nicheInterests = nieruchomości`.
5. Dodać wyraźny ekran podsumowania profilu przed promptami.

### Etap 2: lepsza personalizacja

1. Rozbudować style o kategorie:
   - premium,
   - lokalne,
   - beauty,
   - sport,
   - gastro,
   - tattoo,
   - tech,
   - dzieci,
   - edukacja,
   - e-commerce.
2. Dodać selektor kolorów zamiast samego inputa tekstowego.
3. Dodać wybór fontowego klimatu:
   - elegancki,
   - nowoczesny,
   - odważny,
   - klasyczny,
   - magazynowy.
4. Dodać wybór poziomu komunikacji:
   - premium,
   - prosto i lokalnie,
   - ekspercko,
   - sprzedażowo,
   - luźno.

### Etap 3: prawdziwe szablony materiałów

1. Stworzyć bibliotekę layoutów.
2. Każdy materiał powinien mieć kilka wariantów.
3. Użytkownik powinien widzieć miniatury layoutów.
4. Prompt powinien zawierać wybrany layout.

### Etap 4: backendowa analiza AI

1. Dodać endpoint analizy.
2. AI powinno wykrywać branżę, klienta, ofertę i brakujące dane.
3. AI powinno proponować materiały i styl.
4. Wynik analizy powinien być zapisywany jako część projektu.

### Etap 5: panel projektów firmowych

1. Lista firm/projektów.
2. Szczegóły firmy.
3. Brandbook.
4. Prompty.
5. Wygenerowane grafiki.
6. Edycja i ponowne generowanie.

## 10. Najważniejszy wniosek

Obecny system jest dobrym prototypem kreatora promptów, ale nie jest jeszcze pełnym systemem firmowym.

Żeby był wartościowy dla użytkownika, musi przejść z modelu:

```text
formularz -> prompt
```

na model:

```text
projekt firmy -> analiza AI -> brandbook -> materiały -> generacje -> historia projektu
```

To jest kierunek, który warto teraz wdrożyć.
