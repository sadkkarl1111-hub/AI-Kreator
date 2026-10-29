# Generator SVG z prompta

Generator wysyła opis do tekstowego modelu Gemini 3.8 Flash (thinking LOW). Model projektuje nową grafikę wektorową; szablony działają osobno, bez API. Wynik nie jest konwersją bitmapy ani wyszukiwaniem ikony.

## Rozliczanie kredytami — 2026-10-07

Generator z prompta wymaga zalogowanego konta i kredytów. Domyślna cena to 10 kredytów; wpis `svg-generator` w `tool_pricing` można zmienić lub wyłączyć w panelu administratora. Inicjalizacja bazy dodaje wyłącznie brakujący wpis, bez nadpisywania późniejszych zmian. Administratorzy korzystają z dotychczasowego zwolnienia z opłat, tak jak w pozostałych narzędziach AI. Biblioteka SVG i szablony nadal działają bez API i kredytów.

`GET /public/svg-generator` udostępnia dostępność, aktualną cenę i informację o wymaganym logowaniu. Generowanie obsługuje `POST /ai/svg-generator`; stary `POST /public/svg-generator` również wymaga uwierzytelnienia i tych samych rozliczeń. Przeglądarka przesyła cenę pokazaną użytkownikowi (`expectedCreditCost`); nieaktualna cena powoduje 409 przed pobraniem kredytów. Rzeczywisty koszt i zwolnienie administratora zawsze ustala serwer.

Saldo jest pomniejszane atomowo przed wywołaniem Gemini, co chroni przed jednoczesnymi żądaniami przy zbyt małym saldzie. Brak środków zwraca 402 bez użycia API. Błąd dostawcy, niepoprawny wynik, anulowanie trwającej generacji lub błąd zapisu historii powodują zwrot zarezerwowanych kredytów. Udany wynik zapisuje `svg-generator` w historii użycia i zwraca rzeczywiste `creditsUsed`. Przeglądarka odświeża saldo i nie ponawia automatycznie płatnego żądania po błędach API. Limit 10 prób dotyczy konta i adresu IP; zmiana IP nie omija limitu konta. Rezerwacje salda korzystają z istniejącego mechanizmu aplikacji; nagłe zatrzymanie procesu między rezerwacją a zwrotem wymaga uzgodnienia salda, tak jak w pozostałych narzędziach AI.

Wdrożono obraz API `sha256:13765dbaeb9266f7e8d204173efdcd1e36c179e78794e111d53af1e8f5d02301` i frontend. Kopie przed zmianą: `/var/backups/ai-kreator/svg-paid-20261007`; tag powrotu: `vps-api:before-svg-paid-20261007`. Nie zmieniono kluczy API ani sald istniejących użytkowników. Testy backendu 36/36, formularza 8/8; kompilacja i lint zmienionych plików frontendu poprawne.

Test integracyjny `vps/server/test/svgPromptBilling.integration.mjs` uruchomiono w kontenerze z prawdziwą bazą danych i jednorazowym kontem: potwierdzono uwierzytelnianie, atomowe obciążenie, historię, brak podwójnego wydania salda przy równoległych próbach, zwroty po błędzie/anulowaniu i zwolnienie administratora. Jedna prawdziwa generacja Gemini przez uruchomiony serwer pobrała dokładnie 10 kredytów. Konto testowe i jego rekordy usunięto. Publiczne żądania POST bez sesji zwracają 401 na obu adresach. Test przeglądarkowy na produkcji potwierdził oznaczenia, logowanie i darmowe szablony/bibliotekę przy 320/390/1280 px; dodatkowe odpowiedzi testowe potwierdziły odświeżanie salda, blokadę braku kredytów i widok administratora. Brak poziomego przewijania i błędów JavaScript.

## Poprawa jakości — 2026-10-07

Po zgłoszeniu słabej jakości zmieniono Gemini 2.5 Flash na Gemini 3.8 Flash i zastąpiono ogólny prompt osobnymi zasadami dla ikon, logo, ilustracji i wzorów. Ikony domyślnie korzystają z obrysu, spójnych linii i ograniczonej palety, zamiast ciężkich wypełnień. Ilustracje mają dokładniejsze wskazówki dotyczące anatomii, sylwetki, warstw i proporcji; logo dotyczą inne zasady niż ilustracji.

Porównano prawdziwe wyniki dla koszyka z sercem, lisa na księżycu i logo kawiarni. Wybrano LOW ze względu na jakość i czas: około 8 s dla ikony, 30 s dla ilustracji i 11 s dla logo w próbach. Czasy są obserwacją testową, nie gwarancją. Końcowy test przez działający interfejs wygenerował koszyk z dokładnie zgłoszonego opisu w około 9 s wraz z eksportami SVG/PNG. Sprawdzono wyświetlanie, eksport, szerokości 320/390/1280 px i brak błędów JavaScript. Testy backendu: 30/30. Jakość i układ kolejnych wyników mogą się różnić.

Obecny obraz API: `sha256:48d04792f8bf62dc3d809e1958bb4eb786f5cc2f654d3fedd619508c52b9076c`; kopia poprzedniego źródła i identyfikatora obrazu: `/var/backups/ai-kreator/svg-quality-20261007`; tag powrotu: `vps-api:before-svg-quality-20261007`. Nie zmieniono kluczy, ustawień kredytów, frontendu ani bazy danych.

## Stan wdrożenia — 2026-10-07

Frontend i endpointy są wdrożone na https://ai-kreator.pl/tools/svg-generator. Użytkownik zaakceptował użycie istniejącego klucza Gemini i ewentualny koszt API; włączono `SVG_AI_USE_EXISTING_GEMINI=true`. Generowanie AI jest aktywne. Prawdziwy test przez interfejs wygenerował SVG z opisu lisa na księżycu; sprawdzono poprawność XML, wyświetlanie grafiki, pobieranie SVG, PNG 1024×1024 i kopiowanie SVG. Cały test z eksportami trwał około 19 sekund. Sprawdzono szerokości 320/390/768/1280 px. Testy backendu: 29/29.

Kopia sprzed wdrożenia: `/var/backups/ai-kreator/svg-prompt-20261007`; poprzedni obraz API: `vps-api:before-svg-prompt-20261007`. Kopia środowiska sprzed aktywacji: `env-before-activation` w tym chronionym katalogu. Zmieniono wyłącznie flagę użycia istniejącego klucza. Nie zmieniano kluczy, konfiguracji proxy ani bazy danych.

Przy prawdziwym wywołaniu Gemini odrzuciło pierwotny schemat odpowiedzi z powodu zbyt wielu stanów narzuconych przez zagnieżdżone limity długości. Uproszczono schemat wysyłany do modelu; limity liczby elementów, długości tekstu, atrybutów i rozmiaru SVG nadal są sprawdzane przez serwer. Obraz API po tej poprawce: `sha256:7d454ccdde43e5d1e6e996340ab5eebdde080111c88f1aeb353a31a618310a2f`; poprzedni: `vps-api:before-svg-schema-fix-20261007`.

## Uruchomienie

Domyślnie wymagany jest `SVG_GEMINI_API_KEY` w środowisku backendu. Aby generowanie było bezpłatne również dla właściciela aplikacji, klucz musi pochodzić z projektu Google AI Studio w planie Free Tier, bez włączonego rozliczania. Sam model z darmowym limitem nie oznacza, że istniejący klucz z płatnego projektu nie naliczy opłat.

Alternatywnie operator może świadomie ustawić `SVG_AI_USE_EXISTING_GEMINI=true`, aby wykorzystać istniejący `GEMINI_API_KEY`. Wtedy obowiązuje plan rozliczania tego projektu. Dedykowany klucz ma pierwszeństwo. Żaden klucz nie trafia do przeglądarki; aplikacja rozlicza generowanie kredytami zgodnie z cennikiem.

Dokumentacja dostawcy: [cennik](https://ai.google.dev/gemini-api/docs/pricing), [rozliczanie projektu i kluczy](https://ai.google.dev/gemini-api/docs/billing), [generateContent](https://ai.google.dev/api/generate-content).

## Zachowanie i ograniczenia

- Publiczne `GET /public/svg-generator` zwraca dostępność, cenę i limit; uwierzytelnione `POST /ai/svg-generator` przyjmuje opis, rodzaj grafiki, wymiary, przezroczystość, kolor tła i oczekiwaną cenę.
- Opis: 5–2000 znaków; wymiary: 64–2048 px. Interfejs udostępnia format kwadratowy, poziomy i Stories.
- Limit: 10 prób na konto i adres IP oraz 100 prób łącznie na 24 godziny, maksymalnie 2 równoczesne generowania. Liczniki są w pamięci pojedynczego procesu i resetują się po jego restarcie. Nie stanowią limitu rozliczeń dostawcy.
- Backend jest dostępny przez lokalny port i Apache (obsługiwany jest też nginx). Limit IP korzysta z ostatniego adresu `X-Forwarded-For`, dopisywanego przez reverse proxy. Nagłówki podane wcześniej przez klienta nie wyznaczają limitu.
- Jedno wywołanie modelu, bez automatycznych ponowień i bez przełączenia na inny płatny model. Czas żądania do dostawcy ograniczony do 55 sekund. Anulowanie lub zamknięcie strony przerywa połączenie.
- Model zwraca JSON z kształtami. Serwer dopuszcza tylko ścieżki, koła, elipsy, prostokąty, wielokąty, linie i tekst oraz sprawdzone atrybuty. XML składa serwer. Skrypty, bitmapy, adresy URL i zewnętrzne zasoby nie są dopuszczane.
- SVG i PNG można pobrać, a kod SVG skopiować. Błąd kolejnej próby zachowuje poprzednią grafikę. Błąd AI nie podstawia szablonu.
- Generator nadaje się do prostych ilustracji i ikon. Nie zapewnia fotorealistycznych obrazów ani identycznego wyglądu napisów przy różnych fontach systemowych.

## Sprawdzanie

`npm test` w katalogu głównym sprawdza formularz, eksport poprzedniego wyniku, anulowanie i dostępność. `npm test` w `vps/server` sprawdza walidację, ochronę eksportowanego SVG, dane wysyłane do dostawcy, błędy API i limity żądań. Testy automatyczne korzystają z odpowiedzi testowych i nie zużywają płatnego API. Test prawdziwej generacji wymaga uruchomionego klucza.
