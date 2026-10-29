# Badge’e i ikony do codziennej pracy

- 32 nowe, autorskie badge’e PNG z przezroczystym tłem: CTA, webinary i kursy, usługi i kontakt, karuzele i treści.
- 112 nowych ikon Lucide; łącznie biblioteka zawiera 196 ikon w 13 kategoriach. Wyszukiwanie obsługuje polskie słowa także bez znaków diakrytycznych.
- Gwiazdki zapisują ulubione na danym urządzeniu. Listy są wspólne dla biblioteki i okna wstawiania w karuzelach; osobne dla badge’ów i ikon. Nie przechowują uprawnień ani obrazów.
- Karuzele → Grafiki → Ikony: wybór koloru, grubości linii i kategorii; kliknięcie wstawia ruchomy obraz PNG na aktywny slajd. Ikony są dostępne również na górnym pasku mobilnym i w menu przy zaznaczonym elemencie.
- Ikony mieszczą się w istniejącym limicie 8 obrazów / 16 elementów na slajdzie. Obsługują przesuwanie, obrót, powielanie, cofanie, zapis projektu i eksport.
- Pobieranie i wstawianie nie wywołują generatorów AI i nie pobierają kredytów. Istniejące ograniczenia pakietów badge’ów oraz ukrywanie przez administratora nadal obowiązują, także dla ulubionych.

## Pliki i odtwarzanie zasobów

`node scripts/generate-work-badges.mjs` odtwarza 32 PNG, ich źródła SVG i katalog `src/lib/workBadges.ts`. Grafiki zawierają autorskie geometryczne piktogramy; nie korzystają z zewnętrznych zdjęć ani ikon.

Nowe badge’e są dołączone do wspólnego katalogu, więc pojawiają się również w zarządzaniu badge’ami administratora, edytorze AI i karuzelach. Widoczność i pakiety pochodzą z istniejącego endpointu biblioteki; błąd jego odczytu nie odsłania ukrytych elementów.

Ikony Lucide mają licencje ISC / MIT. Pobierane SVG zawierają informację o licencji. W karuzeli rasteryzujemy wyłącznie ikony dołączone do aplikacji; pobieranie dowolnego zewnętrznego SVG nie zostało włączone.

## Weryfikacja i wdrożenie — 2026-10-25

73 testy w 8 zestawach; kontrola zmienionych plików ESLint i kompilacja produkcyjna zakończone poprawnie. Sprawdzone w Chrome lokalnie i po wdrożeniu: pobieranie PNG i SVG z właściwą ikoną oraz licencją, kolor i grubość linii, ulubione, ukrywanie i pakiety, wstawianie do karuzeli, cofanie / ponawianie, przywrócenie projektu oraz eksport PNG. Widoki: 320, 390, 768, 1024 i 1366 px. Brak wywołań generatorów AI w tych operacjach. Publiczna biblioteka produkcyjna zwróciła 200; istniejących 7 ukrytych badge’ów pozostaje ukrytych.

Kopia poprzedniego frontendu: `/var/backups/ai-kreator/work-assets-20261025/frontend.tar.gz`. Suma SHA256 wdrożonego `index.html`: `141b9df7c7a2b74e4090786bf5b8e93b6921bc5ded8b480518114ddea01fdff1`. Backend nie był modyfikowany.

## Dodatkowe gwarancje i webinary — 2026-10-25

Dodano 6 osobnych grafik wygenerowanych wbudowanym imagegen, z przezroczystym tłem: szmaragdowo-złota tarcza „30 dni gwarancji zwrotu”, granatowo-srebrna pieczęć „60 dni gwarancji zwrotu”, miedziana pieczęć „100% zwrotu”, fioletowo-złoty bilet „Webinar na żywo”, żółty bilet „Dołącz do webinaru” i niebieska karta „Nagranie webinaru”. Oryginalne PNG zapisano w `src/assets/badges/premium/`; katalog `src/lib/premiumBadges.ts` dołączono do wspólnej listy. Prompty: `scripts/premium-badge-prompts.json`.

Pozostały w istniejących kategoriach „Gwarancje” i „Webinar”, obok dotychczasowych grafik. Ustawienia ukrywania i pakietów nadal obsługuje wspólna biblioteka.

Weryfikacja: 28 testów bibliotek i uprawnień, ESLint oraz build poprawne. Chrome lokalnie i na produkcji: pobranie wszystkich 6 PNG z alfa, wstawienie wszystkich 6 do karuzeli, zapis projektu i eksport slajdu PNG; widoki mobilne 320 i 390 px. Kopia poprzedniej wersji: `/var/backups/ai-kreator/premium-badges-20261025/frontend.tar.gz`. Aktualny SHA256 `index.html`: `d31166867a6de3cb7f2f16653290e58a712d84a54764e22e103b9f06ef7820f5`. Backend bez zmian.

## Widoczność całej biblioteki i kolejne wzory — 2026-10-25

Przyczyną trudności ze znalezieniem nowych badge’ów był początkowy limit 12 starszych elementów i umieszczenie nowych zasobów dalej w katalogu. Biblioteka wyświetla teraz wszystkie dopasowane karty, a obrazy poniżej ekranu wczytuje leniwie. Sortuje po `addedAt`, najnowsze na początku. Widok `?view=new` obejmuje zasoby z ostatnich 30 dni, po zastosowaniu ograniczeń widoczności administratora. „Wszystkie” i „Pokaż wszystkie badge’e” czyszczą wyszukiwanie, kategorię oraz widoki nowych / ulubionych. Licznik podaje rozmiar biblioteki i liczbę dopasowań. Mobilnie kategorie są w rozwijanej liście.

Karuzele i zarządzanie badge’ami również zaczynają od najnowszych. Okno karuzeli ma kategorię „Nowe badge’e”, licznik oraz przycisk pokazania wszystkich wyników. Istniejące pakiety i ukrywanie nadal obowiązują.

Dodano 4 kolejne PNG z przezroczystością: bordową gwarancję zwrotu 90 dni, niebieską tarczę „14 dni na zwrot zakupu”, koralowy bilet „Zapisz się na webinar” i fioletowo-złoty prezent „Bonus dla uczestników”. Pliki: `src/assets/badges/premium/`. Wbudowany imagegen, prompty: `scripts/additional-badge-prompts.json`.

Apache zwraca teraz dla HTML `Cache-Control: no-cache, must-revalidate`, także dla tras aplikacji i hosta www; zasoby z nazwą zawierającą hash zachowują dotychczasowe buforowanie. Aktualizacja konfiguracji przeszła `apache2ctl configtest` i łagodne przeładowanie. Backend bez zmian.

Kontrola: 33 testy w 6 zestawach, ESLint i build poprawne. Chrome lokalnie oraz na produkcji: 99 widocznych badge’ów, 42 nowe, sprawdzone wszystkie 99 adresów obrazów (bez błędów), nowe na początku, filtry i ich reset, pobieranie 4 nowych PNG, wstawianie do karuzeli, zapis JSON i eksport PNG, widoki 320 / 390 / 1366 px. Panel administratora pokazuje cały katalog 106 elementów wraz z kontrolami ukrywania; 7 wcześniej ukrytych pozostaje niewidocznych publicznie.

Kopia frontendu i konfiguracji Apache: `/var/backups/ai-kreator/badge-visibility-20261025/`. Aktualny SHA256 `index.html`: `60169aa71c06518e906f8fa6d7baad70ee721863060be046e23907b7b102fe94`.

## Sześć dodatkowych bonusów — 2026-10-25

Dodano „Bonus do kursu”, „Materiały PDF”, „Gotowe szablony”, „Checklista”, „Prezent dla Ciebie” i „Pakiet bonusów”. To osobne, wygenerowane wbudowanym imagegen grafiki 3D z przezroczystym tłem, zapisane bez zmian jako PNG w `src/assets/badges/bonus/`. Prompty: `scripts/bonus-badge-prompts.json`. Katalog: `src/lib/bonusBadges.ts`, kategoria „Bonusy”, `addedAt` z chwili rozpoczęcia generowania. W bibliotece, karuzelach i administratorze pojawiają się jako najnowsze.

Stan po wdrożeniu: 112 elementów katalogu, 105 widocznych publicznie, 48 w widoku „Nowe”; dotychczasowe 7 ukrytych pozostaje ukrytych. Chrome lokalnie i na produkcji potwierdził pobranie wszystkich 6 PNG z przezroczystością, wstawienie wszystkich 6 do karuzeli, zapis JSON, eksport PNG oraz widoki 320 / 390 / 1366 px. Bez błędów przeglądarki. Build i ESLint poprawne, 33 testy przeszły; test dużego panelu administratora przeszedł osobno po przekroczeniu limitu 5 s przy równoległej kompilacji.

Kopia poprzedniej wersji: `/var/backups/ai-kreator/bonus-badges-20261025/frontend.tar.gz`. Aktualny SHA256 `index.html`: `a8b57618878d9fad3ba7eed46395e1d633fabd20484ae7480c80eaddaf0de318`. Backend i konfiguracja Apache bez zmian w tym wdrożeniu.

## Kolory „Pakietu bonusów” i uruchomienie Studia reklam — 2026-10-25

Dodano zielony, czerwony, niebieski i pomarańczowy wariant dotychczasowego fioletowego „Pakietu bonusów”. Edycja przez wbudowane imagegen zachowuje polskie napisy, kompozycję i przezroczystość; oryginalny plik pozostaje bez zmian. Nowe PNG zapisano w `src/assets/badges/bonus/bonus-bundle-{green,red,blue,orange}.png`, prompty w `scripts/bundle-color-prompts.json`. Są w „Bonusy”, widoku „Nowe”, karuzelach i panelu administratora. Łącznie 116 elementów, 109 widocznych publicznie, 52 nowe; siedem istniejących ukrytych nie zostało odsłoniętych.

W ramach dodatkowej prośby użytkownika uruchomiono generator reklam dla zalogowanych kont: menu „Reklamy” przestało być zapowiedzią, a `/generator-reklam` używa `ProtectedRoute`. Płatne konto ma dostęp także bez roli administratora. Darmowe konto zachowuje komunikat zakupu pakietu. Serwer sprawdza administratora lub zakup o statusie `completed` dla generowania koncepcji i wszystkich tras analizy konkurencji. Nowe `requireAdGeneratorAccess` odrzuca niezalogowanych, darmowe konta i nieudane odczyty uprawnień. Ciało żądania nie może nadać płatnego dostępu. Przygotowywanie koncepcji ma limit 20 wywołań na 15 minut i dotychczasową blokadę jednoczesnych zadań. Rozliczanie obrazów pozostaje w istniejącym generatorze kredytowym. Asystent firmy i panel administratora zachowują ograniczenie do administratora. Integracja Meta nadal wymaga wcześniejszej konfiguracji tokenu; nie została uruchomiona przez tę zmianę.

Weryfikacja: 34 testy badge’ów, 23 testy interfejsu Studia i 39 testów serwera; build obu aplikacji i ESLint zmienionych plików poprawne. Test pełnego panelu badge’ów ma teraz limit 15 sekund i węższe selektory, aby nie przekraczał 5 sekund na obciążonym komputerze. Chrome lokalnie i na produkcji: pięć kolorów pakietu (z oryginałem), pobieranie czterech nowych PNG, wstawianie i eksport karuzeli, widoki 320 / 390 / 1366 px. Studio sprawdzono w kontrolowanych sesjach płatnej i darmowej bez roli admina, z odizolowanymi odpowiedziami API; formularz, generowanie kart, menu desktop / mobile, przekierowanie gościa i zachowanie ograniczenia Asystenta firmy działają. Zewnętrzni dostawcy nie byli wywoływani w tych testach. Dodatkowo uruchomiono test płatny / admin / darmowy na skompilowanym module w kontenerze produkcyjnym; rzeczywiste trasy API dla gościa zwracają 401, health 200.

Wdrożono wyłącznie trzy zmienione pliki źródeł serwera i frontend, zachowując konfigurację oraz istniejące dane. Kopia: `/var/backups/ai-kreator/bundle-colors-20261025/`; poprzedni obraz: `vps-api:before-ads-open-20261025`. Aktualny SHA256 `index.html`: `1b2467ceea1da1b801267a0664224cd550569b66ce9f649097360fcfe9c371e8`. Obraz API: `sha256:1404fa201490c839c195a4d95dded1f498c63ea831dca9be99e83bbaf6c1c7a5`.

## Dwa przykłady na stronie głównej — 2026-10-25

Na prośbę użytkownika ponownie wygenerowano przykładową reklamę i mockup produktu z `PublicDemo`. Reklama zawiera nową fikcyjną postać kobiety, odświeżony nagłówek i program; usunięto datę starego wydarzenia. Mockup zachowuje kategorię pudełka / ebooka, z nowym projektem okładki i edukacyjnym podtytułem. Oba obrazy zawierają trwały napis „Wygenerowano przy użyciu AI”. To edycje przez wbudowane imagegen na podstawie dotychczasowych obrazów; prompty zapisano w `scripts/demo-refresh-prompts.json`.

Nowe oryginały PNG: `public/demo-assets/ad-example-ai-v2.png` i `mockup-example-ai-v2.png`. Strona używa odpowiadających plików WebP (960×960 i 960×1440, jakość 90). Starsze obrazy zachowano. Nowe nazwy plików zapobiegają wyświetlaniu poprzedniej wersji z pamięci podręcznej. Kategorie przeniesiono pod obrazy, aby nie zasłaniały nagłówków; podpis AI jest też widoczny pod każdą kartą, w tekście alternatywnym i w powiększeniu.

Weryfikacja: build produkcyjny i ESLint poprawne; Chrome lokalnie i na produkcji, szerokości 320 / 390 / 768 / 1366 px: dwa nowe obrazy, podpisy AI, otwieranie i zamykanie obu podglądów, brak poziomego przepełnienia i błędów JavaScript. Bez zmian serwera API lub konfiguracji. Kopia frontendu: `/var/backups/ai-kreator/demo-refresh-20261025/frontend.tar.gz`. SHA256 `index.html`: `f8656ccbab5eb8bed2f723257fdc0ff9582c403cfa245042f05ec139da8dab05`.


Studio reklam: darmowy zestaw promptów raz na 7 dni na IP i konto; analiza inspiracji ma osobną taką samą pulę. Grafiki rozliczane osobno. Rabaty maksymalnie 20%. Szczegóły limitów i rejestru kosztów: `AD_GENERATOR_REBUILD.md`.


## Publiczne przykłady reklam — 2026-10-25

Sześć oryginalnych reklam inspirowanych referencją użytkownika: pizzeria, beauty, fitness, obuwie sportowe, angielski i kawiarnia. Wygenerowane narzędziem image_gen jako osobne obrazy 1122 × 1402 px. Nowe fikcyjne postacie i nieoznaczone markami produkty; każda grafika zawiera „PRZYKŁAD • GRAFIKA AI”.

Pliki projektu: `public/demo-assets/gallery-ads-20261025/` — oryginały PNG, zoptymalizowane WebP, `6-reklam-ai.zip` oraz `manifest.json` z nowymi identyfikatorami galerii i promptami. Pełne specyfikacje generowania: `scripts/public-gallery-ad-prompts-20261025.json`. Oryginały image_gen zachowane w miejscu wygenerowania.

Publikacja tworzy wyłącznie sześć nowych publicznych rekordów demonstracyjnych (`user_id=NULL`), bez zmiany widoczności czy plików istniejących grafik użytkowników. Galeria: `https://ai-kreator.pl/galeria-publiczna`. Miniatury publicznej galerii stosują `object-contain`, aby pokazywać całe projekty. Kopia poprzedniego frontendu i lista dotychczasowych publicznych grafik: `/var/backups/ai-kreator/public-ads-20261025`.

Weryfikacja publikacji: wszystkie 6 rekordów publicznych, po 6 plików PNG/WebP i ZIP zwracają 200; Chrome desktop i 390 px: obrazy 1122 × 1402, pełne miniatury, otwieranie podglądu, kopiowanie/remiks promptu i brak poziomego przewijania. Brak błędów JS. Kompilacja poprawna; ESLint tego komponentu nadal zgłasza wcześniejszy efekt `fetchGraphics` i zależności (bez związku ze zmianą dopasowania obrazu). Frontend SHA256: `dd4a310c9a4ecbed524e42abc37975dcb5f98463cdd4076b53cb2bec7e626c96`. API i konfiguracja rozliczeń pozostały bez zmian.
