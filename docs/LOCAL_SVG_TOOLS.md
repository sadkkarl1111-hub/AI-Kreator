# Darmowe narzędzia wektorowe

## Wektoryzacja — `/tools/vectorize`

Publiczne narzędzie, bez logowania, kredytów i wywołań dostawców AI. Przyjmuje lokalne PNG/JPEG/WebP do 12 MB i 40 megapikseli. Przeglądarka odczytuje obraz, zmniejsza go do maksymalnej krawędzi 384/640/960 px i przekazuje piksele do osobnego Web Workera. Źródłowy plik nie jest przesyłany na serwer. Wynik zawiera ścieżki SVG, bez osadzania bitmapy; wymiary eksportu zachowują oryginalne proporcje i rozmiar.

Silnik: [ImageTracerJS 1.2.6](https://github.com/jankovicsandras/imagetracerjs), licencja Unlicense, przypięta wersja w package-lock.json. Biblioteka jest dostarczana z aplikacją, bez CDN. Wykorzystane API i opcje opisuje [dokumentacja projektu](https://github.com/jankovicsandras/imagetracerjs/blob/master/options.md).

Ustawienia: 2/4/8/16 kolorów lub czarno-biały z progiem luminancji; dokładność; wygładzanie; usuwanie białych pikseli połączonych z krawędzią. Ostatnia opcja zachowuje białe szczegóły zamknięte wewnątrz logo. Przezroczyste regiony nie są eksportowane jako kształty. Zmiana ustawień oznacza poprzedni wynik jako wymagający ponownego przeliczenia. Błąd kolejnej próby zachowuje ostatni wynik.

Przeznaczenie: logo, ikony i płaskie ilustracje. Fotografie ulegają uproszczeniu i nie są odtwarzane fotograficznie. Usuwanie tła dotyczy wyłącznie jasnych regionów przy krawędzi; nie segmentuje obiektów jak AI. Limit pracy 30 s, eksport do 5 MB; anulowanie, nowy obraz i opuszczenie strony kończą Workera oraz unieważniają stare odpowiedzi. PNG używa istniejącego eksportera SVG aplikacji.

## Napisy z efektami — `/tools/text-effects`

Publiczne narzędzie bez API i kredytów. Sześć efektów: 3D, neon, złoto, obrys, cień i gradient. Obsługuje do 240 znaków w maksymalnie 4 wierszach, cztery systemowe rodziny fontów, zmianę kolorów, wielkości, odstępów i siły efektu oraz przezroczyste lub kolorowe tło. Podgląd aktualizuje się lokalnie. Szerokość eksportu 1200 px; wysokość dopasowuje się do tekstu, a za długie wiersze są pomniejszane. XML jest escapowany, a kolory i fonty ograniczone do bezpiecznych wartości.

SVG zawiera edytowalny tekst, bez zamiany czcionek na krzywe. Wygląd może się różnić na komputerze bez danego fontu. PNG utrwala wygląd z bieżącej przeglądarki. Informacja ta jest pokazana przy ustawieniach.

## Integracja i sprawdzenie

Oba narzędzia mają leniwie ładowane publiczne trasy i karty „Darmowe” na `/tools`. Identyfikatory `vectorize` i `text-effects` są dodawane do `tool_pricing` z ceną 0 przez inicjalizację schematu, wyłącznie jeśli wpis nie istnieje. Pozwala to zarządzać widocznością i aktywnością kart w istniejącym panelu. Silniki pozostają lokalne i nie pobierają kredytów.

Testy jednostkowe w `src/lib/localSvgTools.test.ts` sprawdzają ograniczenie pracy, zachowanie białych wnętrz, przezroczystość, prawdziwe kontury, kolorowe regiony, odrzucenie pustego wyniku, wszystkie efekty, polskie znaki, XML i dopasowanie długich napisów. 44/44 testów modułów SVG oraz formularza płatnego generatora przeszło; backend 36/36. Sprawdzono lint nowych/zmienionych plików i kompilację. W projekcie pozostają wcześniejsze błędy pełnego sprawdzenia TypeScript w innych modułach; brak błędów w nowych modułach.

Przeglądarka Chrome potwierdziła działanie rzeczywistego Workera, pobieranie SVG i PNG, piksele przezroczystego tła i zachowanie białego wnętrza logo, tryb monochromatyczny, obsługę niepoprawnego pliku, wszystkie sześć efektów z polskimi znakami, nieobcięte krawędzie efektów, tło przezroczyste i pełne, pusty tekst, publiczne karty oraz szerokości 320/390/768/1280 px. Nie wykonano wywołań generowania AI; brak błędów JavaScript.

## Wdrożenie — 2026-10-17

Oba narzędzia są opublikowane na https://ai-kreator.pl. Pełne sprawdzenie eksportów w przeglądarce powtórzono na produkcji; dodatkowo sprawdzono anulowanie opóźnionego Workera i udane rozpoczęcie kolejnej konwersji. Publiczny cennik potwierdza aktywne, widoczne wpisy `vectorize` oraz `text-effects` z ceną 0. Cena generatora AI z prompta nadal wynosi 10 kredytów.

Frontend `index.html` SHA256: `b7fb78bb236203f64935d8c4806818a162a3bc1e0691006a530ae2b6deca4565`. Obraz API: `sha256:0b2a395197703ab9188356c85d90b3171fa56723930fe9465c64496f88e9f2f5`. Zmiana backendu obejmuje wyłącznie dodanie brakujących wpisów narzędzi do istniejącego schematu. Kopie poprzedniego frontendu, źródła inicjalizacji bazy i identyfikatora obrazu API: `/var/backups/ai-kreator/local-svg-tools-20261017`; tag poprzedniego obrazu: `vps-api:before-local-svg-tools-20261017`. API działa poprawnie po wdrożeniu.
