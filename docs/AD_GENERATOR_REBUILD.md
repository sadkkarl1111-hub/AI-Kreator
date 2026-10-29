# Generator reklam — przebudowa 2026-09-05

## Rozszerzenie Studia reklam — 2026-10-25

Studio obsługuje dowolne branże, a nie zestaw z góry wybranych konkurentów. Użytkownik określa własną ofertę i cel (automatycznie, sprzedaż, kontakty/zapisy lub wiadomości), a opcjonalnie wybiera do sześciu inspiracji. Materiały własne i teksty konkurencji mają osobne wejścia. Analiza faktów nadal otrzymuje wyłącznie własny opis/zdjęcia; inspiracje i cel trafiają jako oddzielny `campaignContext` do koncepcji i ograniczonej naprawy duplikatów. Zachowano 12 różnych kierunków oraz 6 propozycji ze zdjęciem i 6 od podstaw.

Przy każdej propozycji można teraz wygenerować gotową grafikę bez otwierania kolejnej karty. Wybór modelu i jego ceny, formaty 1:1/4:5/9:16/3:2 oraz kompozycje A (oryginalna), B (zbliżenie) i C (głębia/perspektywa). Każdy klik generuje jeden obraz z serwerową kontrolą ceny i zwykłym zapisem w galerii; do trzech wyników na koncepcję w bieżącej sesji. Referencyjne koncepcje wymagają osobnego, jawnie wybranego własnego zdjęcia i modelu obsługującego referencje. Zdjęcia konkurencji nie są automatycznie używane jako twarz/produkt. Zachowano istniejący przycisk otwarcia pełnego generatora. Obrazy pozostają po filtrowaniu i nieudanej kolejnej próbie; nowy zestaw koncepcji czyści wcześniejsze podglądy. Podczas generowania obrazów nie można zastąpić całego zestawu. Żądania płatne ponawiają wyłącznie odświeżenie autoryzacji po 401.

Nowy panel „Konkurencja i plan testów” pozwala wyszukać dowolne hasło lub numeryczne ID strony na wybranym rynku UE/UK. Integracja używa wyłącznie `https://graph.facebook.com/<version>/ads_archive` z tokenem w nagłówku, bez pobierania adresów podanych przez użytkownika. Próbka obejmuje do 20 reklam z tekstem; API zwraca metadane/teksty i bezpieczny kanoniczny link do Biblioteki Meta, nigdy snapshot/paging z tokenem. Nie pobiera kreacji graficznych i nie udaje analizy ich wyglądu. Daty emisji nie są traktowane jako dowód rentowności. Nie zwracamy zmyślonych CTR, CPA, ROAS ani rankingu zwycięzców.

`GET /ad-generator/library/status`, `POST /ad-generator/library/search` i `POST /ad-generator/library/analyze` wymagają zalogowania. Aktualne limity tygodniowe i rozliczanie opisano poniżej. Nowe operacje mają limit 20/15 minut na użytkownika, timeout i obsługę anulowania. Analiza OpenAI Luna otrzymuje osobno własną ofertę oraz teksty przykładów i zwraca obserwacje ze sprawdzonymi ID źródeł oraz propozycje testów A/B z hipotezą, wariantami i metryką. Raport znika po zmianie materiałów; pozostaje po zwinięciu formularza. Klient nie ponawia generowania po błędach 5xx/sieci. Ogólne testy są prowadzone na kontrolowanych danych, bez wydawania kredytów użytkowników.

### Konfiguracja Meta i ograniczenia

Na produkcji podczas wdrożenia brak `META_AD_LIBRARY_ACCESS_TOKEN` i `META_GRAPH_API_VERSION`. Automatyczny import jest zatem jawnie niepodłączony; obecnie działa otwarcie publicznej Biblioteki dla dowolnego hasła i wklejenie tekstów wybranych reklam do analizy. Pełne automatyczne pobieranie wymaga zatwierdzonego przez Meta dostępu Ad Library, ważnego tokenu i wspieranej wersji Graph API ustawionych w `vps/.env`, a następnie odtworzenia tylko kontenera API. Nie należy wklejać tokenu do publicznego formularza ani do czatu. Nazwy zmiennych dodano do `.env.example`; prawdziwa konfiguracja serwera pozostała bez zmian. Wyszukiwanie w żywym API Meta nie zostało potwierdzone bez uprawnień; klient i serwer są testowane na kontrolowanych odpowiedziach, w tym błędach autoryzacji i odpowiedziach zawierających tajne adresy.

Oficjalny zakres: https://www.facebook.com/ads/library/api/ (odczytana również wersja https://br-fr.facebook.com/ads/library/api/?source=archive-landing-page). Meta dokumentuje reklamy polityczne/społeczne i reklamy dowolnego typu emitowane w UE/UK; są to dane o treści, emisji i zakresie dystrybucji, a nie sprzedaży konkurencji.

### Walidacja

18 testów frontendowych (formularz, inspiracje, generowanie i izolacja nowej karty), 52 testy backendu, build klienta/API i lint zmienionych plików poprawne. Pełny TypeScript nadal ma wcześniejsze błędy innych modułów, bez błędów nowych plików. Jeden powtórny przebieg testów HTTP w sandboxie nie miał poprawnego dostępu do lokalnych serwerów; wszystkie 52 testy przechodzą z dozwolonym interfejsem localhost. Chrome: dowolna branża i cel, jawny brak Meta, link wyszukiwania, wklejone inspiracje, plan testów, utrzymanie raportu po zwinięciu formularza, 12 koncepcji, model/cena/format/kompozycja, wymagane własne zdjęcie, pobieranie, utrzymanie wyników po filtrze/błędzie oraz czyszczenie po nowej kampanii. Również ścieżka skonfigurowanego Meta na atrapie API. Szerokości 320/390/768/1024/1366/1885 px bez poziomego przepełnienia i błędów JS.

### Wdrożenie 2026-10-25

Frontend SHA256 `index.html`: `bbc6e0f5af00a8d494b150f9cf0227474a48dfc69cd9e653b63efcf6128cb5be`. Obraz API: `sha256:ef7e6ad759ccd23d442a1d18f36d76a5c22d560e1e17c307040cfe786e059bd3`. Wdrożono pięć plików źródłowych API i frontend, bez restartu Postgresa/Redisa. Sumy prawdziwego `.env` i `docker-compose.yml` potwierdzają brak zmian. Kopie poprzedniego frontendu i źródeł: `/var/backups/ai-kreator/ad-studio-20261025`, tag powrotu `vps-api:before-ad-studio-20261025`. Zachowano starsze zasoby z hashami dla otwartych kart.

Pełny opisany przebieg Chrome powtórzono na produkcji z kontrolowanymi odpowiedziami API — poprawny, bez błędów JavaScript. `/api/health` poprawne, nowe trasy bez logowania zwracają 401. Dodatkowy rzeczywisty test modułu analizy w działającym kontenerze użył dwóch fikcyjnych reklam i ogólnego opisu pracowni świec: GPT-5.6 Luna zwrócił 3 obserwacje z poprawnymi źródłami i 3 testy z metryką „Koszt zakupu” w 8,4 s. Test nie zapisywał danych w bazie ani nie zmieniał sald użytkowników. Meta pozostaje jawnie nieskonfigurowana; bez tokenu nie wykonywano wyszukiwania rzeczywistych reklam konkurencji.

## Zakres

- Wejście: opis lub zdjęcia (można połączyć), bez wyboru stylów przed analizą.
- Analiza faktów ze źródeł, mechanizmu oferty, konkretnych korzyści i celu kliknięcia.
- Dwanaście koncepcji: mocny plakat, historia filmowa, editorial, produkt/3D, kolaż, problem–rozwiązanie, demonstracja, premium oraz dżungla, basen, góry i budowa. Cztery nowe warianty mają osobny filtr „Sceniczne” po wygenerowaniu wyników.
- Osobne pola nagłówka, podtytułu, korzyści, CTA, sceny i kompozycji. Kod składa finalny prompt; instrukcje nie trafiają do listy widocznych napisów.
- Wyniki: podgląd copy, paleta, filtry kategorii, zwijany pełny prompt i analiza źródeł. Na życzenie użytkownika usunięto sekcję „Tło, bohater i efekty” spod kart. Jasna informacja, że karty to podgląd tekstu, a nie gotowe obrazy; instrukcje wyglądu pozostają w promptach.
- Mocny plakat: ogromny skondensowany nagłówek, wycięta postać/produkt, faktura tła, kierunkowe strzałki, ikony/rekwizyty, szeroki kontrastowy CTA z obrysem i kontrolowaną poświatą. Styl inspiracji nie wymusza „20 błędów”, darmowej oferty ani obcego bonusu.
- Scenerie mają konkretne otoczenie oraz czynność powiązaną z ofertą. Służą jako metafory, a nie obietnice zysków, luksusu ani nowej usługi. Wymagania stylu są dołączane przez kod poza listą widocznych napisów; kontrola słów kluczowych scenerii nie jest pełną oceną semantyczną ani gwarancją zachowania modelu obrazowego.
- Nowa karta generatora otrzymuje odizolowany prompt przez sessionStorage. Nie nadpisuje ani nie kasuje szkiców innych projektów.
- Generator obrazu nie narzuca stylu fotograficznego koncepcjom reklamowym. Zdjęcie referencyjne służy zachowaniu osoby/produktu, a nie kopiowaniu starego układu.
- Każdy pełny zestaw 12 koncepcji zawiera dokładnie 6 reklam zaprojektowanych pod zdjęcie referencyjne osoby lub produktu oraz 6 reklam generowanych od podstaw. Przy reklamie referencyjnej karta podaje, jakie zdjęcie załączyć i jak zostanie użyte; prompt wymaga zachowania tożsamości osoby albo wyglądu produktu w nowej kompozycji. Dla usług eksperckich, webinarów i marek osobistych preferowany jest wyraźny portret do pasa z twarzą i gestem dopasowanym do hooka.
- Szybkie odczytanie i uporządkowanie materiałów wykonuje GPT-5.6 Luna z reasoning `low`, natomiast wszystkie właściwe koncepcje, hooki i kierunki wizualne nadal przygotowuje GPT-5.6 Sol. Integracja korzysta z OpenAI Responses API, ścisłego schematu JSON i `store: false`. Wyniki pokazują model odpowiedzialny za prompty. Modele obrazowe, asystent firmowy i pozostałe narzędzia pozostają bez zmian.
- Każda koncepcja zawiera teraz `emphasisPl`: dokładny, znaczący fragment hooka (1–4 słowa). Kod sprawdza, czy fraza rzeczywiście występuje w nagłówku, a następnie dodaje zależny od stylu kierunek typograficzny: zmianę koloru/skali/grubości oraz podkreślenie, marker, blok lub linię. Cały nagłówek nie może mieć jednakowego koloru, rozmiaru i grubości. Podgląd karty pokazuje tę samą wyróżnioną frazę.
- Każdy skompilowany prompt zawiera blok `CONTRAST LOCK`: pełna nieprzezroczystość liter, mocna różnica jasności względem lokalnego tła, czysta strefa copy i wyraźny akcent. Zakazane są m.in. szary tekst na czerni lub brązie, ciemny tekst na ciemnym tle oraz CTA zlewające się ze sceną. Styl premium ma osobną regułę, aby klimat i materiały nie obniżały czytelności.
- Integracja korzysta z istniejącego klucza OpenAI. Nie zmieniano kluczy, konfiguracji VPS, SSL, domen ani bazy.

## Obsługa błędów

- Odpowiedź AI ma schemat JSON. Kontrola kompletności, limitów copy, duplikatów, stylów, palet i odwołań do faktów.
- Maksymalnie jedna ponowna próba etapu; zawsze z oryginalnymi materiałami, nie z urwanym JSON-em. Błędy uprawnień dostawcy nie są ponawiane.
- Trzy równoległe grupy po cztery koncepcje: działające grupy mogą zostać pokazane jako jawnie niepełny zestaw.
- Hooki powtarzające się między grupami uruchamiają najwyżej jedno dodatkowe wywołanie poprawiające do czterech wariantów, z listą użytych nagłówków. Naprawa nie uruchamia ponownie całej kampanii; w razie niepowodzenia pozostaje jawnie częściowy wynik.
- Anulowanie i limit czasu przerywają pracę. Jeden aktywny przebieg na użytkownika w obecnej konfiguracji jednego procesu API.
- Klient nie ponawia POST po błędach 4xx/5xx/sieci; wyjątkiem jest pojedyncze odświeżenie uwierzytelnienia po 401.
- Nieudana nowa próba nie usuwa formularza ani poprzednich wyników.
- Pusta oferta po analizie zatrzymuje generowanie: użytkownik otrzymuje prośbę o czytelniejsze zdjęcie lub opis, zamiast reklam o nieczytelnej treści.
- Zdjęcia HEIC/HEIF są konwertowane do JPEG przed wysłaniem do OpenAI. Brak dostępu do modelu i wyczerpanie salda mają osobne komunikaty; nie następuje cichy powrót do Gemini.

## Weryfikacja

- `npm test`: 17 testów przechodzi, w tym formularz, przesyłanie samego zdjęcia, filtrowanie, anulowanie, zachowanie wyników, izolacja kart, informacja o modelu, usunięta sekcja sceny i nowy filtr.
- Backend: build oraz 18 testów przechodzi. Polecenie: `npm run build`, następnie `node --test test/adCreative.test.mjs` w `vps/server` (Node 24 w ograniczonym środowisku Windows pozwala też na `--test-isolation=none`). Testy obejmują format Responses, schemat, obrazy, dokładny miks 2/2 w każdej czteroelementowej grupie, limity powtórzeń, odmowę, brak uprawnień, pustą ofertę, wszystkie scenerie i ograniczoną naprawę duplikatów.
- Build produkcyjny klienta i backendu przechodzi.
- Sprawdzenie w prawdziwej przeglądarce z atrapą API: 1440 px i 390 px, brak poziomego przepełnienia/błędów JS, 12 kart (4 sceniczne), brak starego opisu sceny, poprawny prompt w nowej karcie, zachowany szkic firmy. Zrzuty sprawdzono wizualnie.
- Pełny frontendowy `tsc --noEmit` nadal zgłasza wcześniejsze błędy w komponentach calendar/chart/resizable, CompanyAssistant, CompanyAssistantV2, Generator (typ zadania), Privacy, Profile i Terms; nie zostały objęte tą zmianą.
- Rzeczywisty test Luna z opisem automatyzacji: 8 koncepcji, 31 s, trzy wywołania bez ponawiania; 5282 tokeny wejścia i 5096 wyjścia (w tym 149 reasoning), około 0,00717 USD. Zachowane fakty o formularzu, CRM, fakturach i odpowiedzi e-mail, bez wymyślonej liczby zaoszczędzonych godzin.
- Rzeczywisty test Luna z samym czytelnym zdjęciem webinaru: 29 s, trzy wywołania; prawidłowo odczytana bezpłatna oferta, odbiorca początkujący, ETF-y, koszty, ryzyko i 500 zł miesięcznej wpłaty (nie ceny). 7 unikalnych koncepcji: jeden powtarzający się hook odrzucony, wynik jawnie częściowy. 6864 tokeny wejścia i 5218 wyjścia. To nie jest test gwarantujący bezbłędny OCR.
- Pierwsza syntetyczna grafika testowa nie miała czytelnych liter z powodu braku fontów w kontenerze. Zastąpiono ją sprawdzonym wizualnie PNG; dodano kontrolę pustej oferty. Wcześniejszy test Gemini kończył się HTTP 429 `RESOURCE_EXHAUSTED`.
- Skrypt `vps/server/test/adCreative.smoke.mjs` ma scenariusze automation, product i image-webinar; używa płatnego API, ale nie zapisuje danych do bazy. Wymaga `OPENAI_API_KEY`; dla zdjęć można ustawić `AD_SMOKE_IMAGE` na czytelny PNG. Jawnie częściowy wynik powoduje kod wyjścia 1.
- Test po dodaniu scenerii: Luna zwróciła 12 kompletnych koncepcji w 32 s (4 wywołania, bez powtórzeń), 9095 tokenów wejścia i 6905 wyjścia. Sprawdzono opisy rysowania: plakat z wyciętą postacią/strzałkami/CTA, dżungla z liśćmi, basen z kawą i procesem, górski szlak oraz budowa. Nie generowano płatnych obrazów — to test jakości i kompletności promptów, nie finalnego renderu grafiki.
- Rzeczywisty test Sol po zmianie typografii: 12 kompletnych koncepcji w 86 s, 4 wywołania, 9320 tokenów wejścia i 9918 wyjścia (w tym 2945 reasoning), około 0,236 USD według stawek 4 USD/1M input i 20 USD/1M output. Wszystkie 12 fraz `emphasisPl` występowało dokładnie w hooku i każdy skompilowany prompt zawierał kierunek typografii oraz dodatkowe wyróżnienie. Model zachował fakty i nie wymyślił liczby zaoszczędzonych godzin.
- Rzeczywisty test Sol po dodaniu miksu referencji: 12 kompletnych koncepcji w 95 s, 4 wywołania, 10367 tokenów wejścia i 9796 wyjścia (w tym 2630 reasoning). Wynik zawierał dokładnie 6 reklam ze zdjęciem i 6 bez zdjęcia; warianty ze zdjęciem obejmowały mocny plakat, historię filmową, kolaż, demonstrację, dżunglę i basen. Każdy z sześciu promptów zawierał instrukcję zachowania postaci lub produktu. Nie wymyślono liczby zaoszczędzonych godzin.
- Kontrola interfejsu przy 1440 px i 390 px potwierdziła 12 wskazówek zdjęciowych, dokładnie 6 oznaczeń „Załącz zdjęcie: TAK” i 6 „NIE”, brak przepełnienia oraz prawidłowe przekazanie promptu do nowej karty generatora.
- Test produkcyjny po optymalizacji czasu: kompletny zestaw 12 reklam powstał w 49 s zamiast 100 s w bezpośrednio poprzednim pomiarze. Sol nadal przygotował koncepcje, a Luna wyłącznie analizę materiałów. Wynik zachował dokładnie 6 reklam ze zdjęciem i 6 bez; zużycie wyniosło 10071 tokenów wejścia i 7530 wyjścia, w tym 328 tokenów reasoning. Czas dostawcy może się zmieniać zależnie od obciążenia i liczby zdjęć.

## Publikacja 2026-09-05

- Wgrano cztery pliki backendu: moduły `adCreative`, `adCreativeAi`, trasę generatora reklam i zawężoną obsługę kierunku artystycznego w trasie obrazów. Zbudowano i uruchomiono ponownie wyłącznie usługę API.
- Opublikowano zbudowany interfejs, pozostawiając wcześniejsze pliki zasobów dla otwartych kart. Suma SHA-256 serwowanego `index.html` zgadza się z lokalnym buildem.
- Sprawdzono stałą `gpt-5.6-luna` w działającym kontenerze, publiczne health API oraz odpowiedź 401 generatora bez logowania. Postgres i Redis nie zostały restartowane.
- Porównanie sum `.env` i `docker-compose.yml` przed/po publikacji potwierdziło brak zmian. Nie zmieniano SSL ani konfiguracji pozostałych domen.
- Kopia poprzednich tras i strony wejściowej: `/opt/ai-kreator-backups/luna-20260905`. Nie wykonywano migracji bazy ani testu zalogowanego żądania HTTP na koncie użytkownika; testy rzeczywistego modelu uruchamiano bez zapisu do bazy.

## Publikacja 2026-09-06

- Wdrożono GPT-5.6 Sol i reguły mocniejszej typografii. Kontrola produkcyjna potwierdziła `gpt-5.6-sol` oraz kompilację kierunku `Typography direction` w działającym kontenerze.
- Frontend i źródła API mają sumy zgodne z lokalnym buildem. Publiczne i wewnętrzne health API działają, a niezalogowane żądanie generatora zwraca oczekiwane 401.
- Sumy `.env` i `docker-compose.yml` nie zmieniły się. Postgres i Redis zachowały wcześniejszy czas uruchomienia; nie zmieniano SSL, domen, bazy ani pozostałych usług.
- Pierwsza próba publikacji użyła błędnej wewnętrznej ścieżki health i automatycznie przywróciła poprzednią wersję. Po potwierdzeniu pełnego rollbacku poprawiono kontrolę i wdrożono ponownie. Kopia wersji sprzed udanej publikacji: `/opt/ai-kreator-backups/sol-typography-20260906-attempt2`.
- Wdrożono wymuszony miks 6 reklam ze zdjęciem referencyjnym i 6 generowanych od podstaw. Zbudowano i uruchomiono ponownie tylko usługę API; kopia wersji sprzed zmiany znajduje się w `/opt/ai-kreator-backups/reference-mix-20260906`.
- Po publikacji wewnętrzne i publiczne health API zwróciły poprawną odpowiedź, a niezalogowane żądanie generatora zwróciło oczekiwane 401. Sumy `.env`, `docker-compose.yml` i serwowanego `index.html` nie zmieniły się; Postgres i Redis nie zostały restartowane.
- Przyspieszono przebieg bez zmiany modelu odpowiedzialnego za jakość reklam: analiza używa Luna/low, a trzy równoległe partie koncepcji używają Sol/low z dotychczasowymi rygorystycznymi instrukcjami i walidacją. Automatyczna naprawa powtórzonego hooka zachowuje teraz pierwotny plan zdjęcia, więc pełny zestaw pozostaje 6/6. Kopie wersji sprzed dwóch etapów optymalizacji: `/opt/ai-kreator-backups/fast-analysis-20260906` i `/opt/ai-kreator-backups/fast-prompts-20260906`.
- Wdrożono globalny blok kontrastu oraz poprawiony kierunek stylu premium. Kontrola działającego kontenera potwierdziła obecność `CONTRAST LOCK`; health API działa, a sumy konfiguracji i frontendu pozostały bez zmian. Kopia poprzedniej wersji: `/opt/ai-kreator-backups/contrast-lock-20260906`.

## Granice

Oddzielenie tekstu od instrukcji i limity copy zmniejszają ryzyko błędnych napisów, ale nie gwarantują idealnej typografii modelu obrazowego. Źródła wizualne są odczytywane przez AI, nie przez niezależnie zweryfikowany OCR. Konwersję trzeba porównać w rzeczywistych kampaniach; warianty nie są obietnicą wyników.


## Uruchomienie dla płatnych kont — 2026-10-25

Trasa `/generator-reklam` używa teraz `ProtectedRoute`; menu desktop / mobile udostępnia aktywne „Reklamy”. Historyczny wymóg pakietu zastępuje opisana poniżej bezpłatna pula tygodniowa. Administracja i Asystent firmy zachowują własne dotychczasowe ograniczenia. Rozliczanie obrazów pozostaje bez zmian. Generowanie koncepcji: limit 20/15 minut i jedna aktywna analiza na konto.

Testy: 23 frontendowe i 39 backendowych poprawne. Chrome lokalnie i na produkcji: płatne konto bez roli admina, darmowa oferta pakietów, gość kierowany do logowania, aktywne menu desktop / mobile; odpowiedzi dla testowych kont izolowane w przeglądarce, bez wywoływania płatnych dostawców. Skompilowany produkcyjny middleware sprawdzono oddzielnie w kontenerze (płatny / admin / darmowy), a rzeczywiste trasy dla gości zwracają 401. Health 200. Meta nadal niepodłączona.

Wspólne wdrożenie z kolorowymi badge’ami: kopia `/var/backups/ai-kreator/bundle-colors-20261025/`, poprzedni obraz `vps-api:before-ads-open-20261025`. Frontend SHA256 `1b2467ceea1da1b801267a0664224cd550569b66ce9f649097360fcfe9c371e8`; API `sha256:1404fa201490c839c195a4d95dded1f498c63ea831dca9be99e83bbaf6c1c7a5`. Konfiguracja .env i Compose bez zmian.


## Darmowe prompty i ochrona kosztów — 2026-10-25

Każde zalogowane konto może rozpocząć jeden zestaw promptów co 7 dni. Limit dotyczy jednocześnie IP i konta, obejmuje wszystkie pakiety oraz administratorów. Osobny limit jednego rozpoczęcia co 7 dni dotyczy analizy inspiracji; wyszukiwanie Meta nie zużywa tych pul. Grafiki nadal są rozliczane osobno według ceny wybranego modelu.

`ad_ai_weekly_limits` przechowuje trwałe identyfikatory HMAC (bez surowego IP); transakcja i blokady rekordów chronią przed równoległymi żądaniami i zmianą konta. Apache dopisuje rzeczywisty adres na końcu X-Forwarded-For; pierwszy wpis podany przez klienta nie jest zaufany. Zmiana sekretu HMAC resetuje identyfikację limitów. Wspólny IP oznacza wspólną pulę, również w firmie. Walidacja i brak klucza nie zużywają limitu, rozpoczęte wywołanie AI zużywa go również przy błędzie lub anulowaniu.

`GET /ad-generator/access` zwraca obie pule, termin kolejnej próby i ostatni zestaw należący do zalogowanego użytkownika. Odświeżenie strony przywraca prompty bez kolejnego AI. `429 AD_WEEKLY_LIMIT` zawiera Retry-After. Błąd bazy blokuje wywołania dostawcy.

Każde wywołanie Responses zapisuje osobny rekord w `ad_ai_usage`: model, status, rzeczywiste liczniki tokenów, cache, reasoning, migawkę stawek i szacowany koszt USD. Reasoning jest częścią wyjścia i nie jest doliczany drugi raz. Brak usage oznacza nieznany koszt (NULL), nie zero. To estymacja według cennika API, nie faktura dostawcy. Rekord zawiera najniższą cenę kredytu z aktywnych pakietów po maksymalnym rabacie 20% (obecnie Enterprise). Kredyty za prompty i badanie: 0. To dane do kontroli rentowności, bez automatycznej zmiany cen pakietów lub gwarancji marży po podatkach i opłatach.

Wszystkie nowe i istniejące kupony mają globalny limit 20% wartości zakupu, także kwotowe. Kod LATO40 obniżono z 85% do 20%; nazwa i liczniki wykorzystania są zachowane.

### Weryfikacja wdrożenia limitów

61 testów backendowych i 19 frontendowych przeszło; kompilacje obu części i ESLint zmienionych plików poprawne. Pełne sprawdzenie typów frontendowych nadal zgłasza wcześniejsze problemy w innych modułach (m.in. calendar/chart/resizable i CompanyAssistant); brak błędów w zmienionych plikach limitów.

Chrome na lokalnym i opublikowanym wydaniu: konto darmowe, jednorazowe przygotowanie, wyłączony przycisk po limicie, zapisane prompty po odświeżeniu, oddzielna blokada badania, rozmiary 1366/390/320 px, bez błędów JS. Wywołania testowego konta przechwycono — bez kosztów API.

Test na rzeczywistej bazie używał odseparowanych losowych kluczy i usunął je po próbie: równoczesne żądania z tym samym IP przepuszczają jeden; inne konto na zajętym IP i to samo konto z innym IP są blokowane; oddzielna pula badania działa; nowa instancja magazynu pamięta wykorzystanie; po upływie 7 dni dostęp wraca. Zapis rzeczywistych liczników tokenów i estymacji kosztu potwierdzony atrapą dostawcy, rekord testowy usunięty. Najtańszy kredyt po maksymalnym rabacie: 0,01061333 PLN.

Produkcja: frontend SHA256 `df16b733c223b4439fcec5adde193630c45a2fb4544b7239ff81a58dc2e3273c`, obraz API `sha256:dfca0d05f5f159f8c7d50b185cdaea4fb100512409e01ca8b6b6bdf4755cf0a5`. Health 200, trasy bez logowania zwracają 401, HTML wymaga odświeżenia cache. Konfiguracja środowiska i Compose zachowała sumy kontrolne. Kopia poprzedniej wersji i oryginalnego kuponu: `/var/backups/ai-kreator/weekly-ads-20261025`; obraz awaryjny `vps-api:before-weekly-ads-20261025`.
