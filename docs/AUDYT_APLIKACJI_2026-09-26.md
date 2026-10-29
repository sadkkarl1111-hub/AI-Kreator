# Audyt aplikacji i folderu — 26.09.2026

## Aktualizacja po poprawkach

Po audycie uszczelniono lokalnie obsługę certyfikatów Tpay: akceptowany jest wyłącznie oficjalny adres certyfikatu powiadomień, przekierowania są odrzucane, a pobieranie ma limit 5 sekund i 32 KiB. Wymagany jest algorytm `RS256` oraz poprawny format odłączonego podpisu JWS. Dodano testy regresji dla obcych domen, danych logowania w URL, niestandardowego portu, innego protokołu, ścieżki, parametrów i fragmentu.

Backend zaktualizowano do `sharp 0.35.4`, `morgan 1.12.1` i pośredniego `qs 6.16.0`. Aktualny pełny audyt npm backendu: **0 znanych podatności**. Kompilacja i 20 testów backendu przechodzą. Zmiany są lokalne i nie zostały wdrożone na serwer produkcyjny.

## Wynik i zakres

Przeanalizowano lokalny kod frontendu i backendu, konfiguracje wdrożeniowe, zależności, prawa dostępu Windows oraz zbędne pliki robocze. Wykonano także ograniczone, odczytowe sprawdzenia publicznej strony ai-kreator.pl.

Najpilniejsze ustalenia dotyczą dostępu do prywatnych grafik i historii edycji, obsługi sesji oraz pobierania certyfikatu Tpay. Są to ustalenia z kodu, nie dowód wykorzystania luk ani włamania. Bez logów konkretnego zdarzenia nie można rozstrzygnąć przyczyny przesłanego alertu.

W tej pracy wykonano porządki lokalne i uzupełniono `.gitignore`. Nie zmieniono logiki aplikacji, bibliotek, haseł, uprawnień Windows ani produkcji. Zachowano zastane zmiany robocze. Zbudowano ponownie lokalne katalogi `dist` na potrzeby weryfikacji.

Nie sprawdzano przez SSH aktywnych ustawień serwera, bazy danych, uprawnień bucketu S3/R2 ani logów logowania. Nie wykonywano prób wykorzystania luk na produkcji. Wynik przeglądu kodu nie stanowi pełnego testu penetracyjnego.

## Wykonane porządki

Do Kosza Windows przeniesiono 12 archiwów statycznego frontendu oraz 2 puste logi. Łączny rozmiar archiwów: **166 848 644 bajty, czyli 166,85 MB / 159,12 MiB**. Usunięto je z folderu projektu; miejsce na dysku zwolni się po opróżnieniu Kosza. Pliki można obecnie przywrócić z Kosza.

Przed usunięciem sprawdzono zawartość każdego archiwum, położenie w projekcie i brak śledzenia przez Git. Archiwa zawierały wygenerowane pliki strony, nie kod źródłowy, bazę danych ani sekrety.

| Plik przeniesiony do Kosza | Bajty |
| --- | ---: |
| `.deploy-flare-sunburst/frontend.tar.gz` | 8 920 533 |
| `.deploy-flare-sunburst/menu-frontend.tar.gz` | 8 920 068 |
| `.deploy-flare-sunburst/mobile-css-menu.tar.gz` | 8 925 761 |
| `.deploy-flare-sunburst/responsive-menu.tar.gz` | 8 925 636 |
| `ads-qa.local/luna-web.zip` | 7 873 461 |
| `ads-qa.local/photo-guidance-web.tar` | 29 549 056 |
| `ads-qa.local/prompt-history-details-web.tar` | 29 551 616 |
| `ads-qa.local/scenic-web.zip` | 7 873 564 |
| `ads-qa.local/sol-typography-web.tar` | 29 548 544 |
| `ads-qa.local/deploy-ad-library-20260906/frontend-final.tar.gz` | 8 920 360 |
| `ads-qa.local/deploy-ad-library-20260906/frontend-hotfix.tar.gz` | 8 919 827 |
| `ads-qa.local/deploy-ad-library-20260906/frontend.tar.gz` | 8 920 218 |
| `vite-blog-mobile.err.log` | 0 |
| `vite-blog-mobile.out.log` | 0 |

Zachowano kopie `.before.ts`, archiwa kodu i testów, skrypty, załączniki, zrzuty ekranu, oryginalne grafiki, zależności i aktualną kompilację. Oryginalne PNG odznak zajmują około 8,21 MiB, a używane odpowiedniki WebP około 0,89 MiB; sam brak importów PNG nie dowodzi, że materiały źródłowe są zbędne.

Do `.gitignore` dodano `.env.*` (z zachowaniem wyjątku `.env.example`), `.codex-remote-attachments/` i `.deploy-*/`. Sprawdzono, że przykładowe pliki środowiska nadal nie są ignorowane.

## Dostęp do lokalnych plików

- Konto `witel`, SYSTEM i lokalni Administratorzy mają pełne uprawnienia do katalogu głównego projektu.
- Są też cztery wpisy SID z prawem modyfikacji/zapisu, których nie przypisano jednoznacznie do użytkowników lub mechanizmów izolacji. Nie jest to samo w sobie dowód obcego dostępu. Nie usuwano ich bez ustalenia pochodzenia.
- W sprawdzonym ACL katalogu głównego nie ma jawnego wpisu Everyone. To nie rozstrzyga dostępu przez OneDrive ani ustawień udostępniania w chmurze; tych nie badano.
- Właścicielem katalogu głównego jest grupa Administratorzy. Git zgłasza przez to `dubious ownership`. Do odczytu użyto wyjątku tylko dla pojedynczych poleceń i dokładnej ścieżki projektu; nie zmieniono globalnych ustawień zaufania.
- Projekt zawiera wiele zastanych zmian i nieśledzonych plików. Nie cofano ich ani nie usuwano na podstawie samego statusu Git.
- `.env` nadal jest plikiem śledzonym przez Git. Obecnie zawiera jedynie `VITE_VPS_API_BASE_URL`, ale `.gitignore` nie przestanie automatycznie śledzić już dodanego pliku. W przyszłym porządku repozytorium należy pozostawić wersjonowany `.env.example`, a lokalny `.env` wycofać wyłącznie z indeksu.
- Ograniczone wyszukanie typowych prywatnych kluczy i tokenów w aktualnych źródłach, zasobach publicznych i skryptach nie zwróciło trafień. Nie był to kompletny skan historii Git ani archiwów źródeł.

## Najpilniejsze problemy bezpieczeństwa

### 1. Prywatne pliki dostępne po poznaniu adresu — wysoki priorytet

`vps/server/src/app.ts:30` udostępnia `/files/*` bez logowania, sprawdzenia właściciela, flagi publiczności ani podpisu. `vps/server/src/lib/storage.ts:207` tworzy stałe adresy także dla prywatnych grafik i referencji. S3 otrzymuje dodatkowo publiczny cache na rok (`storage.ts:23`, `115`, `248`). Nazwa pola `signedUrl` nie oznacza tu rzeczywistego podpisania adresu.

Skutek: osoba znająca link może pobrać prywatny plik bez konta. Nie wykazano możliwości odgadywania losowych identyfikatorów ani przeglądania całej zawartości storage.

Zalecenie: kontrola uprawnień podczas wydawania i obsługi dostępu do prywatnych plików, krótkotrwałe podpisy lub uwierzytelnione pobieranie oraz prywatne reguły cache. Osobno zachować zamierzone działanie publicznej galerii, odznak i linków udostępniania. Sprawdzić także politykę bucketu i istniejące cache.

### 2. Dostęp do cudzej historii edycji — wysoki priorytet

`vps/server/src/routes/ai.ts:1693` przyjmuje `parentGraphicId` bez sprawdzenia właściciela rodzica. Wartość trafia przez zapis grafiki do `localGraphicsData.ts:352`. Endpoint historii w `routes/gallery.ts:337` sprawdza właściciela tylko początkowej grafiki, następnie przechodzi po rodzicach i dzieciach bez ponownej kontroli (`358`, `369`, `375`, `391`).

Warunki: zalogowany użytkownik posiada kredyty, zna ID cudzej grafiki i skutecznie tworzy własną edycję z tym rodzicem. ID może być dostępne w publicznej galerii. Odczyt historii własnej nowej grafiki może wtedy zwrócić prywatne warianty i opisy drugiej osoby. To wniosek ze ścieżki kodu; nie testowano go na danych użytkowników.

Zalecenie: sprawdzić właściciela rodzica przed uruchomieniem AI oraz uprawnienia do każdego węzła historii. Dodać testy dwóch oddzielnych kont, także gdy część drzewa jest publiczna.

### 3. Pobieranie certyfikatu Tpay z niewłaściwego hosta — wysoki priorytet

`vps/server/src/lib/tpay.ts:228` sprawdza adres certyfikatu przez `startsWith("https://secure.tpay.com")`. Taki warunek przepuszcza również nazwę obcej domeny zaczynającą się tym tekstem. `fetchPemCertificate` (`192`) podąża za przekierowaniami i nie ma własnego limitu czasu ani wielkości odpowiedzi. Żądanie wychodzi przed sprawdzeniem certyfikatu.

Możliwy skutek: niekontrolowane żądanie serwera do obcej lub wewnętrznej sieci (SSRF), przy aktywnym i skonfigurowanym Tpay. Nie wykazano fałszowania płatności: później kod weryfikuje zaufane CA, podpis RSA i checksum. Nie wykonywano takich żądań na produkcji.

Zalecenie: parsować URL i sprawdzać dokładny protokół/host/port, odrzucać dane użytkownika w URL i przekierowania, dodać limit czasu oraz rozmiaru certyfikatu.

### 4. Zmiana hasła nie unieważnia istniejących sesji — wysoki priorytet

Dotyczy resetu hasła (`routes/auth.ts:1633`), profilu (`routes/me.ts:547`) i zmiany przez administratora (`routes/admin.ts:814`). Funkcja `revokeAllLocalRefreshTokensForUser` istnieje, ale nie jest wywoływana z tych miejsc. Aktualizacja hasła również nie unieważnia tokenów wewnętrznie.

Skutek: posiadacz wcześniejszego refresh tokenu może nadal odświeżać sesję po zmianie hasła. Tokeny dostępu są sprawdzane względem podpisu i terminu, bez wersji sesji lub czasu unieważnienia.

Zalecenie: atomowe ustawienie hasła i unieważnienie refresh tokenów, jawna polityka dla bieżącej sesji oraz w razie potrzeby mechanizm unieważniania access tokenów.

Osobny błąd: reset hasła ignoruje niepowodzenie zapisu (`auth.ts:1638`) i może pokazać sukces po zużyciu linku mimo braku zmiany hasła. Akceptuje też każde niepuste hasło, omijając reguły interfejsu. Potrzebna transakcja, kontrola wyniku zapisu i walidacja serwerowa.

## Sesje i alert ze zrzutu ekranu

`src/lib/authSession.ts:186` ogranicza równoległe odświeżenia jedynie wewnątrz pojedynczej karty. Dwie karty mogą wysłać ten sam refresh token. Backend prawidłowo rozpoznaje drugie użycie obróconego tokenu i unieważnia pozostałe tokeny (`vps/server/src/lib/localCredentials.ts:209`). To realna możliwa przyczyna alertu podczas własnego korzystania z aplikacji, lecz nie ustalenie przebiegu konkretnego incydentu.

Dodatkowo `src/lib/vpsApi.ts:131` domyślnie odświeża sesję i ponawia żądanie po dowolnym błędzie, nie tylko po 401. Po błędzie sieci lub 5xx może powtórzyć operację zmieniającą dane albo generowanie. Opcja `retryAuthOnly` jest obecnie używana tylko w części aplikacji.

Zalecenie: synchronizacja odświeżenia między kartami, ponowne sprawdzenie zapisanej sesji po uzyskaniu blokady, ochrona przed nadpisaniem nowego logowania starą odpowiedzią oraz domyślnie najwyżej jedno ponowienie po 401. Przejściowy błąd sieci nie powinien automatycznie niszczyć aktualnej sesji. Zachować serwerowe wykrywanie faktycznego ponownego użycia tokenów.

## Pozostałe zabezpieczenia do poprawy

- **Adres IP w limitach i alertach:** `middleware/rateLimit.ts:35` ufa pierwszemu `X-Forwarded-For`, a `app.ts:14` wszystkim proxy. Szablon Nginx dokleja adres klienta do już istniejącego nagłówka. W takiej konfiguracji można podmienić pierwszy adres. Publiczny serwer odpowiada jako Apache; aktywnej obsługi XFF nie sprawdzano. Ustalić topologię, oczyszczać nagłówek na brzegu i ufać tylko znanym proxy. Sam zgodny adres IP nie rozstrzyga autentyczności logowania.
- **Google OAuth:** podpisany `state` (`routes/auth.ts:461`) nie jest związany z konkretną przeglądarką ani jednorazowo zużywany. Uzupełnić powiązanie z rozpoczętym logowaniem, aby zapobiec login CSRF.
- **Kody 2FA:** `localTwoFactor.ts:182` sprawdza użycie kodu i zapisuje je w oddzielnych krokach. Równoległe żądania mogą zaakceptować ten sam kod. Kody odzyskiwania mają podobny problem. Używać warunkowej, atomowej aktualizacji.
- **Tokeny w localStorage:** zwiększają skutki ewentualnego XSS. Zaplanować bezpieczne cookie HttpOnly/Secure dla refresh tokenu wraz z odpowiednią ochroną CSRF; wymaga to pełnego przeglądu przepływu logowania.
- **Referencje obrazów:** `gallery.ts:309` zapisuje pliki referencyjne bez rejestru czasu życia/limitu liczby. Usunięcie konta sprząta pliki z tabeli graphics, pomijając takie referencje. Dodać rejestr, TTL, limity i sprzątanie przy usunięciu konta.
- **Wdrożenia:** `scripts/deploy-vps.ps1:57` pakuje całe `vps` z tylko dwoma wykluczeniami. Przyszłe `.env`, kopie bazy lub pliki runtime mogą trafić do archiwum. Obecnie lokalnego produkcyjnego `vps/.env` nie znaleziono. Wprowadzić jawną listę plików wdrożenia i ochronę przed nadpisaniem sekretów.
- **Trwałość storage:** dostarczony compose nie montuje wolumenu dla `/app/storage`. Jeśli produkcja używa local storage bez dodatkowej konfiguracji, odtworzenie kontenera grozi utratą plików. Nie dotyczy w ten sam sposób aktywnego zdalnego S3/R2; aktywnego trybu nie potwierdzono.
- **Kontener:** Dockerfile nie ustawia użytkownika runtime; ograniczyć uprawnienia po sprawdzeniu praw do katalogu storage.

## Zależności — aktualny wynik audytu npm

| Zakres | Wynik |
| --- | --- |
| Frontend, zależności produkcyjne | 0 zgłoszeń |
| Frontend, całość z narzędziami | 3 zgłoszenia: 1 high, 2 moderate |
| Backend, całość | 3 zgłoszenia: 1 high, 2 moderate; dotyczą zależności runtime |

Zainstalowane wersje i zalecenia:

- `sharp 0.35.3` w obu projektach: high związane z libheif; poprawka od `0.35.4`. W backendzie biblioteka przetwarza obrazy użytkowników, więc aktualizacja jest priorytetowa. Faktyczne możliwości wykorzystania zależą też od formatu obrazu i kompilacji kodeków. [Advisory Sharp](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c).
- `morgan 1.11.0` w backendzie: moderate, możliwość fałszowania struktury logów; poprawka od `1.12.0`. [Advisory Morgan](https://github.com/advisories/GHSA-jxfw-x594-9x9m).
- `qs 6.15.3` w backendzie: moderate dotyczące parsowania/DoS; aktualizować do wersji zawierającej poprawki (co najmniej `6.16.0` według bieżącego audytu). [Advisory parsera](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [advisory limitów](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx).
- `vitest 3.2.7` i zagnieżdżony `@vitest/mocker`: moderate. Poprawka od `4.1.11` lub stabilnej linii 5; przejście wymaga sprawdzenia kompatybilności konfiguracji. Nie jest to luka statycznej strony produkcyjnej. Opis dotyczy określonych sposobów wystawienia serwera testowego; nie stwierdzono użycia publicznego mockerPlugin w tym projekcie. [Advisory Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).

Nie uruchamiano automatycznego `audit fix --force` ani nie zmieniano wersji. Stary audyt z lipca opisuje wcześniejszy stan i nie zastępuje powyższych wyników.

## Weryfikacja działania i jakości kodu

| Sprawdzenie | Wynik |
| --- | --- |
| `npm test` | 8 plików, 25 testów przeszło |
| Frontend `npm run build` | Sukces |
| Backend `npm run build` | Sukces |
| Backend `node --test test/adCreative.test.mjs` | 18 testów przeszło; bez płatnych wywołań AI |
| `npm run lint` | Nie przechodzi: 143 błędy, 19 ostrzeżeń |
| Frontend `tsc -p tsconfig.app.json --noEmit` | Nie przechodzi: 24 diagnostyki |

Sukces budowania Vite nie oznacza poprawności typów: obecny skrypt budowania nie uruchamia ich kontroli. Wykryte problemy były w istniejącym kodzie; ta praca nie zmieniała kodu aplikacji.

Przykłady: komponenty kalendarza, wykresów i paneli nie są w pełni zgodne z zainstalowanymi interfejsami bibliotek; `Profile.tsx:4052` wywołuje niezdefiniowane `handleCopy` przy kopiowaniu sekretu konfiguracji 2FA. Część błędów dotyczy starego `CompanyAssistant.tsx` i włączenia backendowego middleware do kompilacji testów frontendowych.

Lint obejmuje też zachowane kopie źródeł w `.deploy-flare-sunburst`; warto wykluczyć archiwa robocze w konfiguracji lintera. Samo to nie naprawi pozostałych błędów aplikacji.

## Odczytowe sprawdzenia produkcji

- Strona główna i `/api/health` odpowiadają 200.
- `/api/me` i `/api/gallery` bez tokenu zwracają 401.
- Odczyt listy użytkowników przez właściwy endpoint `/api/admin/users/actions` bez tokenu zwraca 401. Starszy placeholder GET `/api/admin/users` zwraca 501, nie listę danych.
- `/.env` i `/.git/config` zwracają 200 z treścią identyczną ze stroną główną (fallback SPA). Nie zwróciły plików konfiguracyjnych w tej próbie. Zalecane jawne 403/404 dla plików ukrytych; sam fallback nie chroni przed przyszłym przypadkowym skopiowaniem istniejącego pliku.
- Strona główna ma HSTS, nosniff, X-Frame-Options i Referrer-Policy. W odebranej odpowiedzi HTML brak Content-Security-Policy; API ma CSP z Helmet.
- Nagłówek `Server` wskazuje Apache. Zaleceń dla szablonu Nginx nie należy automatycznie traktować jako potwierdzonego stanu produkcji.

Nie badano aktywnych sesji użytkownika ani źródła alertu w logach.

## Co optymalizować

1. Wspólne pobieranie danych konta i uprawnień. Kilka instancji `useIsAdmin` niezależnie wywołuje `/me`. Można wykorzystać już obecną bibliotekę React Query do deduplikacji i kontrolowanego cache.
2. Cennik narzędzi: `src/hooks/useToolPricing.ts:30` nie obsługuje błędu, przez co `loading` może pozostać włączone; cache cen nie wygasa. Dodać obsługę błędów, czas ważności i współdzielenie trwającego żądania.
3. Miniatury generować przy zapisie lub w zadaniu w tle. Obecne sprawdzanie miniatury podczas odczytu galerii może pobierać cały obiekt, zwiększając transfer S3 i opóźnienia.
4. Sprzątać referencje i zwalniać pamięć podglądów: `Generator.tsx:408`, `AdminBadges.tsx:175`, eksport SVG w `QrCodeGenerator.tsx:94` używają adresów blob bez pełnego sprzątania przy zmianie/opuszczeniu ekranu.
5. Dodać `.dockerignore`, aby lokalne zależności, wyniki i sekrety nie trafiały do kontekstu budowania kontenera. Pozostawić tylko potrzebne pliki.
6. Uporządkować duże ekrany Profile i CompanyAssistantV2, nieużywane komponenty oraz zależności po sprawdzeniu użycia pośredniego. Nie usuwać bibliotek tylko dlatego, że nie znaleziono bezpośredniego importu.
7. Trzymać projekt roboczy poza synchronizacją OneDrive, jeżeli powoduje opóźnienia lub konflikty, oraz oddzielnie zadbać o wersjonowanie i kopie bezpieczeństwa. Nie przenoszono katalogu w tej pracy.

Aktualny frontend ma około 29 MiB plików, w tym około 22,8 MiB WASM do usuwania tła. Nie oznacza to pobrania całości przy wejściu na stronę: trasy, PDF i moduł usuwania tła są już ładowane na żądanie. Nie należy usuwać WASM jako rzekomo zbędnego pliku. Pomiary czasu ładowania w przeglądarce i rzeczywistego ruchu użytkowników są osobnym etapem.

Do sprawdzenia przy konfiguracji hosta: szablon Nginx CSP nie uwzględnia domyślnego CDN modeli usuwania tła, a polityka `microphone=()` może kolidować z dyktowaniem. Nie potwierdzono tych awarii w interfejsie produkcyjnym.

## Zalecana kolejność dalszych prac

1. Zamknąć dostęp między kontami w historii edycji oraz dopracować prywatny dostęp do plików i cache.
2. Uszczelnić pobieranie certyfikatów Tpay i zaktualizować podatne zależności backendu.
3. Poprawić równoległe odświeżanie sesji, ponowienia żądań i unieważnianie sesji przy zmianie hasła.
4. Uszczelnić OAuth, jednorazowe kody oraz ustalić zaufane proxy i wiarygodne IP.
5. Naprawić kontrolę typów i rzeczywiste błędy interfejsu, następnie obsługę błędów/cache oraz sprzątanie referencji.
6. Zweryfikować aktywny VPS i storage przed wdrożeniem, dodać testy dwóch użytkowników i równoległych sesji oraz przygotować kontrolowane wdrożenie z możliwością wycofania.
