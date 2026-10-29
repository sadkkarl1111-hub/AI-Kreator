# Audyt bezpieczeństwa — ai-kreator.pl

Data: 2026-07-29  
Zakres: pakiety npm, dostęp do API, autoryzacja, limity, uploady/pliki, płatności, admin, 2FA, nagłówki HTTP.

## Podsumowanie

Aplikacja ma solidne podstawy: API generowania wymaga konta i potwierdzonego maila, panel admina jest chroniony rolami, admin ma 2FA, są alerty mailowe i historia działań, CORS jest ograniczony do znanych domen, płatności mają weryfikowane webhooki, a kredyty są sprawdzane przed generowaniem.

Najważniejsze rzeczy do poprawy:

1. Zaktualizować podatne paczki frontendu: przede wszystkim `react-router-dom`, `vite`, `eslint`.
2. Dodać walidację startową ENV w produkcji — backend nie powinien wstać z domyślnymi sekretami `change_me_*`.
3. Przenieść sesję z `localStorage` w stronę bezpieczniejszego modelu: httpOnly cookie albo krótsze access tokeny + mocniejsza ochrona XSS.
4. Dodać rate limit na `/client-errors/report`.
5. Dodać twardszą walidację uploadowanych obrazów przez `sharp` i limity rozmiaru w `/gallery/save` oraz `/gallery/reference-upload`.
6. Rozważyć Redis-backed rate limit, bo obecny limiter jest pamięciowy i resetuje się po restarcie kontenera.
7. Uszczelnić publiczne pliki przed ryzykiem aktywnych SVG/HTML i dodać bezpieczne nagłówki dla `/files/*`.

## 1. Pakiety npm

### Frontend — `npm audit --omit=dev`

Wynik: 2 podatności `high`.

- `react-router`
- `react-router-dom`

Problem:

- Advisory: `GHSA-qwww-vcr4-c8h2`
- Zakres podatny: `react-router >=7.12.0 <8.3.0`
- Zainstalowany lockfile łapie podatny zakres.
- Najnowsza wersja sprawdzona w npm: `react-router-dom 7.18.2`.

Rekomendacja:

```bash
npm install react-router-dom@latest
npm run build
```

Następnie przetestować:

- `/`
- `/dashboard`
- `/generator`
- `/auth`
- `/profile`
- `/admin` jako admin
- przekierowania po loginie i callback Google

### Frontend — pełny `npm audit`

Wynik: 9 podatności:

- 8 high
- 1 moderate

Dotyczy głównie dev tooling:

- `vite`
- `esbuild`
- `eslint`
- `minimatch`
- `brace-expansion`

Ryzyko produkcyjne:

- Niższe niż `react-router`, bo część dotyczy dev servera, ale nadal warto aktualizować, żeby nie mieć podatnego środowiska deweloperskiego.

Rekomendacja:

Najpierw mały krok bezpieczny:

```bash
npm install react-router-dom@latest
```

Potem osobny krok, ostrożnie:

```bash
npm install vite@latest eslint@latest
```

Uwaga: aktualizacja Vite do nowszego majora może wymagać testów buildu i konfiguracji.

### Backend VPS — `npm audit --omit=dev`

Wynik: 0 podatności produkcyjnych.

### Backend VPS — pełny `npm audit`

Wynik: 1 podatność `low`:

- `esbuild` przez dev dependency.

Ryzyko produkcyjne:

- Niskie, nie dotyczy runtime API.

Rekomendacja:

Przy okazji aktualizacji backendowych paczek podbić dev tooling, ale nie jest to pilne.

## 2. Autoryzacja i konta

### Co jest dobrze

- Endpointy `/me/*`, `/ai/*`, `/gallery/*`, `/admin/*` wymagają Bearer tokena.
- Middleware `requireAuthenticatedUser` sprawdza:
  - obecność tokena,
  - ważność podpisu JWT,
  - istnienie użytkownika,
  - potwierdzenie emaila.
- Admin ma dodatkowe sprawdzenie roli.
- Admin ma 2FA TOTP.
- Dodane są kody odzyskiwania 2FA.
- Refresh tokeny są hashowane w bazie i rotowane.
- Hasła są hashowane przez `scrypt` z solą.
- Przy rejestracji wymagany jest captcha token.
- Email musi być potwierdzony przed użyciem konta.

### Ryzyka / poprawki

#### A. Produkcyjne sekrety mają fallbacki developerskie

W kodzie są fallbacki:

- `change_me_access_secret`
- `change_me_refresh_secret`
- `change_me_totp_secret`
- `change_me_reset_secret`
- `change_me_email_confirmation_secret`
- `change_me_recovery_codes_secret`

To jest OK lokalnie, ale w produkcji backend powinien odmówić startu, jeśli brakuje sekretów.

Rekomendacja P1:

- Dodać walidację w `env.ts` lub `server.ts`.
- W `NODE_ENV=production` wymagać:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
  - `DATABASE_URL`
  - `TURNSTILE_SECRET_KEY` albo odpowiedni secret captcha w bazie
  - klucze AI, jeśli modele są aktywne

#### B. Tokeny sesji są w `localStorage`

Plik: `src/lib/authSession.ts`

Aktualnie access token i refresh token są trzymane w `localStorage`.

Ryzyko:

- Jeżeli pojawi się XSS, skrypt może ukraść tokeny.

Rekomendacja P2:

- Docelowo przenieść refresh token do httpOnly Secure SameSite cookie.
- Access token trzymać krótko w pamięci aplikacji.
- Ewentualnie na teraz skrócić access token i dodać mocniejsze wykrywanie podejrzanych refreshy.

#### C. Brak wymuszenia 2FA dla wszystkich adminów na poziomie roli

Logika wymaga 2FA tylko wtedy, gdy admin ma 2FA aktywne.

Rekomendacja P1/P2:

- Dla każdego konta z rolą `admin` wymusić skonfigurowanie 2FA przed wejściem w panel admina.
- Do czasu konfiguracji admin widzi tylko ekran „Skonfiguruj 2FA”.

## 3. Rate limiting i ochrona kredytów

### Co jest dobrze

Są limity m.in.:

- rejestracja: 5 prób / 20 min
- login: 10 prób / 10 min
- wysyłka emaili: 5 prób / 15 min
- reset hasła: 5 prób / 30 min
- generowanie: 12 prób / 10 min
- edycja: 10 prób / 10 min
- vision/OCR: 20 prób / 10 min
- checkout: 6 prób / 10 min
- dzienny limit wydawania kredytów dla nie-adminów

### Ryzyka / poprawki

#### A. Limiter jest pamięciowy

Plik: `vps/server/src/middleware/rateLimit.ts`

Ryzyko:

- Restart kontenera czyści limity.
- Przy wielu instancjach limit nie będzie wspólny.

Rekomendacja P2:

- Przenieść rate limit do Redis.
- Redis już jest w docker compose, więc to naturalny kolejny krok.

#### B. `/client-errors/report` nie ma rate limitu

Plik: `vps/server/src/routes/clientErrors.ts`

Endpoint jest publiczny i zapisuje logi błędów frontendu.

Ryzyko:

- Ktoś może spamować endpoint i zapchać bazę/logi.

Rekomendacja P1:

- Dodać rate limit po IP, np. 30–60 zgłoszeń / 10 min.
- Opcjonalnie ignorować bardzo podobne błędy z tego samego IP przez krótki cooldown.

#### C. Darmowe kredyty i wiele kont

Jest ochrona przez IP dla bonusu startowego, captcha i email confirmation. To pomaga, ale VPN/proxy nadal mogą obchodzić IP.

Rekomendacje P2:

- Dodać fingerprint ryzyka konta:
  - IP hash,
  - user-agent hash,
  - liczba kont / 24h,
  - liczba nieudanych captcha,
  - domeny mailowe jednorazowe.
- Dla podejrzanych kont:
  - niższy limit dzienny,
  - brak darmowych kredytów do czasu dodatkowej weryfikacji,
  - manual review w adminie.

## 4. API generowania i koszty AI

### Co jest dobrze

- Generowanie wymaga zalogowanego i potwierdzonego konta.
- Koszt jest liczony przed wysłaniem do modelu.
- Sprawdzane są kredyty i dzienny limit.
- Kredyty są odejmowane po udanym zapisie grafik.
- Jeśli odjęcie kredytów się nie uda, wygenerowane pliki są sprzątane.
- Liczba wyników jest ograniczona do 1–4.
- Liczba referencji jest ograniczona:
  - admin: 10
  - zwykły użytkownik: 5
- Referencje mogą pochodzić tylko ze ścieżek użytkownika.
- Jest limit payloadu referencji: 14 MB base64.

### Ryzyka / poprawki

#### A. Możliwy race condition na kredytach przy wielu równoległych generowaniach

Jeżeli użytkownik odpali wiele żądań równolegle, każde może przejść check kredytów przed potrąceniem.

Rekomendacja P1:

- Potrącenie kredytów robić atomowo w transakcji:
  - `UPDATE user_credits SET balance = balance - $cost WHERE user_id = $userId AND balance >= $cost RETURNING balance`
- Najlepiej zarezerwować kredyty przed wywołaniem AI, a przy błędzie AI zrobić refund.

To pozwoli zachować wiele generowań naraz, ale bez ryzyka zejścia poniżej zera lub wykorzystania większej liczby kredytów niż user ma.

#### B. Admin omija limit dzienny

Kod pomija dzienny limit dla admina.

To jest wygodne, ale jeśli konto admina zostanie przejęte, można szybko przepalić budżet AI.

Rekomendacja P1/P2:

- Dla admina dodać osobny bardzo wysoki, ale istniejący limit bezpieczeństwa, np. kwotowy dzienny limit API.
- Po przekroczeniu progu wysłać alert i opcjonalnie blokadę generowania do ręcznego odblokowania.

## 5. Uploady, obrazy i pliki publiczne

### Co jest dobrze

- Ścieżki plików są normalizowane i blokują `..`.
- Referencje do generowania są sprawdzane względem userId.
- Nginx blokuje ukryte pliki `/.env`, `/.git` itd.
- `/files/*` jest przez API, nie bezpośredni listing katalogów.

### Ryzyka / poprawki

#### A. Brak twardej walidacji binarnej obrazu w `/gallery/save`

Plik: `vps/server/src/routes/gallery.ts`

Endpoint sprawdza `data:image/*`, ale nie weryfikuje zawsze realnego typu pliku przez dekodowanie/`sharp`.

Rekomendacja P1:

- W `/gallery/save` i `/gallery/reference-upload`:
  - ograniczyć base64 length,
  - dekodować bufor,
  - przepuścić przez `sharp(buffer).metadata()`,
  - akceptować tylko JPG/PNG/WebP,
  - zapisywać jako WebP/PNG po rekodowaniu, a nie surowy upload.

#### B. Publiczne `/files/*` może serwować aktywne typy, jeśli takie trafią do storage

`storage.ts` zna `image/svg+xml`. SVG bywa ryzykowne, jeśli jest pod tą samą domeną.

Rekomendacja P1/P2:

- Nie dopuszczać SVG jako upload użytkownika.
- Dla `/files/*` dodać:
  - `Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'`
  - `X-Content-Type-Options: nosniff`
  - opcjonalnie `Content-Disposition: inline` tylko dla pewnych obrazów, `attachment` dla reszty.

#### C. Brak limitu rozmiaru w `/gallery/save`

Jest globalny `express.json({ limit: "20mb" })`, ale warto mieć limit per endpoint.

Rekomendacja P1:

- Dodać limit np. 14 MB base64 jak przy referencjach AI.

## 6. CORS, nagłówki, HTTPS

### Co jest dobrze

- `helmet()` aktywny.
- `x-powered-by` wyłączone.
- CORS whitelist:
  - `APP_URL`
  - `FRONTEND_URL`
  - `ADMIN_URL`
- Nginx:
  - HSTS
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - HTTP → HTTPS redirect

### Rekomendacje

P2:

- Doprecyzować CSP w Helmet, bo domyślne jest sensowne, ale aplikacja ma dużo obrazów/generatorów.
- Dodać osobne nagłówki dla `/api/files/*`, bo pliki publiczne to inny profil ryzyka niż HTML aplikacji.

## 7. Płatności i webhooki

### Co jest dobrze

- Webhooki idą przez `express.raw`.
- PayU/Tpay mają osobną walidację podpisów.
- Zakup jest kompletowany po statusie `COMPLETED`.
- Jest idempotencja na poziomie zakupu i statusu.
- Sesja płatności przy weryfikacji musi należeć do użytkownika.

### Rekomendacje

P2:

- Dodać rate limit na publiczne webhooki po IP/providerze, ale ostrożnie, żeby nie zablokować operatora płatności.
- Logować odrzucone webhooki z powodem bez wrażliwych danych.

## 8. Panel admina

### Co jest dobrze

- Panel admina wymaga tokena.
- Operacje są ograniczane rolą `admin` i/lub zakładkami.
- Dodane alerty admina.
- Dodana historia działań admina.
- 2FA i kody odzyskiwania są wdrożone.

### Ryzyka / poprawki

#### A. Brak dodatkowego potwierdzenia przy najgroźniejszych akcjach

Dotyczy m.in.:

- zmiana hasła użytkownika,
- zmiana kredytów,
- usunięcie użytkownika,
- zmiana roli admina,
- konfiguracja kluczy API.

Rekomendacja P2:

- Dla akcji wysokiego ryzyka wymagać świeżego 2FA, np. kod z ostatnich 5 minut.

#### B. Klucze integracji widoczne w panelu po kliknięciu

To wygodne, ale ryzykowne przy przejętej sesji admina.

Rekomendacja P2:

- Sekrety w panelu zapisywać, ale nigdy nie zwracać pełnej wartości do frontendu.
- Pokazywać tylko maskę, np. `sk_live_••••abcd`.
- Do zmiany wymagać ponownego wpisania wartości.

## 9. Logi i dane wrażliwe

### Co jest dobrze

- Błędy providerów AI są logowane z przycięciem body do 1500 znaków.
- Error logi frontendu mają limity długości pól.

### Ryzyka / poprawki

#### A. Możliwe logowanie fragmentów odpowiedzi providerów

W logach AI może znaleźć się część odpowiedzi providera. Zwykle to nie sekret, ale warto uważać.

Rekomendacja P2:

- Dodać funkcję redakcji logów:
  - tokeny,
  - bearer,
  - klucze API,
  - emaile jeśli niepotrzebne,
  - base64/payload.

#### B. Popsute kodowanie polskich znaków

W części plików widać teksty typu `prĂłba`, `bĹ‚Ä…d`.

Ryzyko:

- To nie jest luka sama w sobie, ale utrudnia analizę alertów/logów i może psuć komunikaty bezpieczeństwa.

Rekomendacja P3:

- Przejść pliki backend/frontend i naprawić zakodowane stringi.

## 10. Priorytety wdrożenia

### P1 — zrobić jako pierwsze

1. Zaktualizować `react-router-dom` i lockfile.
2. Dodać rate limit do `/client-errors/report`.
3. Dodać walidację produkcyjnych ENV i blokadę startu przy domyślnych sekretach.
4. Dodać atomiczne rezerwowanie/potrącanie kredytów przy generowaniu.
5. Utwardzić uploady obrazów: limit per endpoint + `sharp` validation + rekodowanie.

### P2 — następna fala

1. Redis-backed rate limit.
2. Wymuszenie 2FA dla każdego admina przed wejściem do panelu.
3. Fresh 2FA dla krytycznych akcji admina.
4. Ograniczenie widoczności sekretów w panelu admina.
5. Dodatkowe limity budżetowe dla admina i globalny dzienny kill switch AI.

### P3 — porządki

1. Naprawa polskich znaków w kodzie.
2. Dodatkowe CSP dla `/files/*`.
3. Lepsze logowanie incydentów i agregacja podobnych błędów.

## Proponowana kolejność pracy

1. Aktualizacja podatnych paczek frontendu.
2. Rate limit `/client-errors/report`.
3. Walidacja ENV produkcyjnego.
4. Atomiczne kredyty.
5. Walidacja uploadów.
6. Redis rate limit.
7. Fresh 2FA dla akcji admina.

