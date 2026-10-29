# Edycja wielu zdjęć — `/tools/batch-images`

Darmowe narzędzie publiczne. Działa w przeglądarce bez logowania, API AI i kredytów. Wejście: do 30 PNG/JPEG/WebP, maksymalnie 12 MB na plik i 150 MB łącznie. Pliki nie są przesyłane na serwer. Oryginały pozostają niezmienione.

## Funkcje

- Konwersja do JPG, PNG i WebP, jakość 30–100% dla formatów stratnych.
- Maksymalny dłuższy bok 1080/1600/1920/2560 px lub oryginał; mniejsze obrazy nie są powiększane.
- Zachowanie przezroczystości PNG/WebP. JPG ma wybierany kolor tła zamiast kanału alfa.
- Znak wodny z tekstu do 80 znaków albo logo; pięć położeń, widoczność i rozmiar procentowy. Logo zachowuje proporcje.
- Bieżący podgląd ustawień na wybranym zdjęciu, pobieranie wyników pojedynczo lub w ZIP. Dwucyfrowy prefiks nazwy zapobiega kolizjom przy powtarzających się nazwach źródeł.
- Informacja o łącznym rozmiarze wyników i oryginałów. Wyniki większe od oryginału są jawnie oznaczone; nie obiecuje się zmniejszenia każdego pliku.

## Przetwarzanie i limity

Obrazy są dekodowane i przetwarzane pojedynczo. Maksymalnie 40 Mpx na wejściu i 20 Mpx na wynikowym obrazie; podgląd ma ograniczony rozmiar. Wyniki w pamięci są ograniczone do 120 MB. Anulowanie lub opuszczenie strony zatrzymuje rozpoczynanie kolejnych operacji; wynik z trwającej operacji jest odrzucany po anulowaniu. Ukończone wcześniej pliki pozostają dostępne. Kodowanie Canvas rozpoczęte przed anulowaniem może jeszcze zakończyć pracę wewnątrz przeglądarki.

Uszkodzony plik nie blokuje reszty paczki. Widoczne są błędy poszczególnych plików i liczba udanych wyników. Przy zmianie ustawień poprzednie wyniki są oznaczone jako wymagające ponownego przetworzenia; pobieranie nie zmienia ich potajemnie. Jeśli przeglądarka nie obsługuje eksportu WebP i zwróci inny MIME, aplikacja zgłasza błąd zamiast zapisywać mylące rozszerzenie. ZIP jest tworzony z gotowych, już skompresowanych obrazów bez dodatkowej kompresji.

## Sprawdzanie

Testy `carouselBrandBatch.test.ts` obejmują wymiary bez rozciągania/powiększania, ograniczenie pamięci, bezpieczne unikalne nazwy, położenie znaku, geometrię logo i walidację projektu karuzeli. Przeglądarka Chrome potwierdziła eksport JPG/PNG/WebP, paczkę ZIP, rozmiar wyników, przezroczyste piksele PNG, tekst z polskimi znakami, logo, kontynuację po uszkodzonym PNG, informację o nieaktualnych ustawieniach, anulowanie, dostęp gościa i szerokości 320/390/768/1280 px. Bez wywołań płatnego API i błędów JavaScript.

Wpis `batch-images` jest dodawany do `tool_pricing` z ceną 0, wyłącznie gdy nie istnieje. Panel administratora obsługuje jego widoczność i aktywność jak pozostałych darmowych narzędzi. Silnik nie pobiera kredytów.

## Wdrożenie — 2026-10-17

Opublikowano na https://ai-kreator.pl/tools/batch-images i powtórzono pełny test przeglądarkowy na produkcji. Potwierdzono aktywny, widoczny wpis w cenniku z kosztem 0; cena płatnego generatora SVG nadal wynosi 10. Backend po zmianie inicjalizacji cennika przeszedł 36/36 testów. Testy powiązanych modułów frontendu 30/30, lint i kompilacja poprawne.

Frontend SHA256 `index.html`: `de134c56adcd6205a9b6836527fe13b11401c167cf79b7afca91189a6342991c`. Obraz API: `sha256:2e9cd38fe6bd1c965de14585dbc23b50b9d7ab04b7d259638eb55cb083ef2860`. Kopia poprzedniej wersji: `/var/backups/ai-kreator/carousel-brand-batch-20261017`; tag powrotu: `vps-api:before-carousel-brand-batch-20261017`. Nie zmieniano kluczy ani sald użytkowników.
