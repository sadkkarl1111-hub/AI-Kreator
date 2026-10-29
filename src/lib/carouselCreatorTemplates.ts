import type { CarouselSlide } from './carouselDesign';
import { carouselContrast } from './carouselConversion';
import { defaultCarouselNavigation } from './carouselNavigation';
import type { CarouselTemplate } from './carouselTemplates';

type CopySlide = Pick<CarouselSlide, 'layout' | 'kicker' | 'title' | 'body' | 'composition' | 'tone' | 'cta' | 'imageFrame' | 'titleMarks'> & { emphasis?: string };
const poster = (kicker: string, title: string, body: string, emphasis: string, tone: CarouselSlide['tone'] = 'dark', composition: CarouselSlide['composition'] = 'creator-cover'): CopySlide => ({ layout: 'cover', composition, kicker, title, body, tone, emphasis });
const step = (kicker: string, title: string, body: string, tone: CarouselSlide['tone'] = 'light'): CopySlide => ({ layout: 'content', composition: 'creator-number', kicker, title, body, tone });
const story = (kicker: string, title: string, body: string, tone: CarouselSlide['tone'] = 'light'): CopySlide => ({ layout: 'content', composition: 'creator-story', kicker, title, body, tone });
const compare = (kicker: string, title: string, body: string): CopySlide => ({ layout: 'content', composition: 'creator-split', kicker, title, body, tone: 'light' });
const end = (title: string, body: string, cta = 'Zapisz na później'): CopySlide => ({ layout: 'cover', composition: 'ending-creator', kicker: 'TWÓJ NASTĘPNY KROK', title, body, tone: 'accent', cta: { text: cta, style: 'pill' } });

function deck(id: string, name: string, theme: string, accent: string, description: string, slides: CopySlide[], sample?: 'male' | 'female'): CarouselTemplate {
  return {
    id, name, theme, description, collection: 'creator',
    design: { titleFont: 'anton', bodyFont: 'arial', background: 'solid', navigation: { ...defaultCarouselNavigation, numberStyle: 'segments', numberX: 81, numberY: 6, numberSize: 22, arrowStyle: 'circle', arrowSize: 42, caption: 'Przesuń po konkrety', footerLine: false } },
    ...(sample ? { sampleImage: `/demo-assets/carousel-creators-20261026/creator-${sample}.webp` } : {}),
    slides: slides.map(({ emphasis, ...slide }) => {
      const start = emphasis ? slide.title.indexOf(emphasis) : -1;
      const marker = slide.tone === 'accent' ? carouselContrast(accent) : accent;
      return { ...slide, imageFrame: 'cutout', ...(start >= 0 ? { titleMarks: [{ start, end: start + emphasis!.length, highlight: marker, color: carouselContrast(marker), highlightPadding: 3, highlightRadius: 3 }] } : {}) };
    }),
  };
}

export const CREATOR_CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  deck('creator-red-manifest', 'Czerwony manifest', 'creator-red', '#f43d36', 'Czerń, biel i czerwień. Mocna okładka ze zdjęciem, konkretne wskazówki i wyrazisty finał.', [
    poster('MARKA OSOBISTA', 'DOBRA TREŚĆ\nTO DOPIERO\nPOCZĄTEK.', 'Liczy się też to, jak ją pokażesz. Oto 4 rzeczy, które warto uporządkować.', 'DOBRA TREŚĆ'),
    step('01 · OBIETNICA', 'POWIEDZ, CO\nZYSKAM.', 'Nazwij jeden efekt, na którym zależy odbiorcy. Bez ogólników i obietnic bez pokrycia.'),
    step('02 · CZYTELNOŚĆ', 'JEDEN SLAJD.\nJEDNA MYŚL.', 'Usuń wszystko, co odciąga od najważniejszej wskazówki. Zostaw miejsce na oddech.', 'dark'),
    compare('03 · ZAMIANA PERSPEKTYWY', 'JA, JA, JA.\nZobacz, ile wiem.', 'TY, TY, TY.\nZobacz, jak możesz to wykorzystać.'),
    step('04 · DZIAŁANIE', 'NIE KOŃCZ\nBEZ KIERUNKU.', 'Wybierz jedno działanie: zapisanie, odpowiedź albo kontakt. Nie proś o wszystko naraz.', 'dark'),
    story('ZANIM OPUBLIKUJESZ', 'PRZECZYTAJ\nJAK ODBIORCA.', 'Czy od razu wiadomo, dla kogo jest ta karuzela i po co ją przesunąć dalej?'),
    end('TREŚĆ MA\nPRACOWAĆ.', 'Zapisz te zasady i sprawdź je przy następnej publikacji.'),
  ], 'male'),
  deck('creator-hooks', 'Hook, który zatrzymuje', 'creator-cream', '#db342d', 'Siedem slajdów o nagłówkach. Duże litery, porównania i przykłady do przerobienia.', [
    poster('PIERWSZY SLAJD', 'NAGŁÓWEK,\nKTÓRY DAJE\nPOWÓD.', 'Odbiorca ma wiedzieć, dlaczego warto zostać. Zobacz prosty schemat.', 'POWÓD.', 'light'),
    compare('ZA OGÓLNIE → KONKRETNIE', 'PORADY\nO TREŚCIACH.', '3 PYTANIA\nPRZED PUBLIKACJĄ.'),
    step('SCHEMAT 01', 'NAZWIJ\nPROBLEM.', 'Zacznij od sytuacji, którą odbiorca rozpoznaje z własnego doświadczenia.', 'dark'),
    step('SCHEMAT 02', 'POKAŻ\nKORZYŚĆ.', 'Powiedz, czego czytelnik się dowie. Zadbaj, aby kolejne slajdy spełniły obietnicę.'),
    compare('NAJPIERW WIARYGODNOŚĆ', 'SEKRET,\nKTÓRY ZMIENI\nWSZYSTKO!', 'PROSTY SPOSÓB\nNA JAŚNIEJSZY\nPRZEKAZ.'),
    story('MINIZADANIE', 'NAPISZ\n3 WERSJE.', 'Jedną przez problem, drugą przez korzyść, trzecią przez pytanie. Porównaj ich konkretność.', 'dark'),
    end('DOBRY HOOK\nDOTRZYMUJE\nOBIETNICY.', 'Zapisz schemat i wróć do niego przy kolejnej okładce.'),
  ]),
  deck('creator-mistakes', '5 błędów na profilu', 'creator-red', '#f43d36', 'Lista z dużymi numerami kroków, naprzemiennym tłem i krótką checklistą.', [
    poster('AUDYT TREŚCI', '5 BŁĘDÓW,\nKTÓRE WARTO\nNAPRAWIĆ.', 'Zacznij od jednej poprawki. Nie musisz zmieniać całego profilu.', '5 BŁĘDÓW,', 'dark', 'creator-portrait'),
    step('BŁĄD 01', 'PISZESZ\nDO WSZYSTKICH.', 'Nazwij konkretną osobę i potrzebę. Łatwiej wtedy dobrać przykład oraz język.'),
    step('BŁĄD 02', 'CHOWASZ\nNAJWAŻNIEJSZE.', 'Przenieś główną myśl do nagłówka. Czytelnik nie powinien jej szukać.', 'dark'),
    step('BŁĄD 03', 'ZA DUŻO\nNA RAZ.', 'Rozbij długi akapit na osobne slajdy. Zostaw jedną myśl i jeden przykład.'),
    step('BŁĄD 04', 'BRAKUJE\nPRZYKŁADU.', 'Pokaż, jak wskazówka wygląda w praktyce. Użyj własnego materiału.', 'dark'),
    step('BŁĄD 05', 'NIE WIADOMO,\nCO DALEJ.', 'Zakończ jednym prostym działaniem, które pasuje do tematu karuzeli.'),
    end('WYBIERZ\nJEDNĄ POPRAWKĘ.', 'Od czego zaczniesz? Podziel się numerem w komentarzu.', 'Napisz numer 1–5'),
  ], 'female'),
  deck('creator-myths', 'Mity kontra praktyka', 'creator-blue', '#2955ed', 'Dwie kontrastowe kolumny. Gotowy zestaw do obalania mitów i pokazywania faktów.', [
    poster('ZMIANA PERSPEKTYWY', 'NIE WSZYSTKO,\nCO SŁYSZYSZ,\nPOMAGA.', 'Oddziel popularną radę od tego, co ma sens w Twojej sytuacji.', 'POMAGA.', 'light'),
    compare('MIT 01 · CZĘSTOTLIWOŚĆ', 'MUSZĘ\nPUBLIKOWAĆ\nCODZIENNIE.', 'POTRZEBUJĘ\nRYTMU, KTÓRY\nUTRZYMAM.'),
    compare('MIT 02 · ZASIĘG', 'KAŻDY POST\nMUSI BYĆ\nVIRALEM.', 'POST MOŻE\nEDUKOWAĆ LUB\nBUDOWAĆ ZAUFANIE.'),
    compare('MIT 03 · OFERTA', 'WIĘCEJ\nFUNKCJI TO\nLEPSZY OPIS.', 'POMÓŻ\nZROZUMIEĆ\nKONKRETNĄ KORZYŚĆ.'),
    story('TWÓJ KONTEKST', 'ZANIM\nPOWTÓRZYSZ RADĘ…', 'Zapytaj: dla kogo zadziałała, w jakiej sytuacji i czy masz podobne warunki?', 'dark'),
    end('SPRAWDZAJ.\nNIE ZGADUJ.', 'Zachowaj karuzelę jako punkt wyjścia do własnych testów.'),
  ]),
  deck('creator-story', 'Osobista historia', 'creator-orange', '#f15b2a', 'Opowieść eksperta: punkt wyjścia, przełom, lekcja i pytanie do odbiorcy.', [
    poster('MOJA HISTORIA · SZABLON', 'ZACZĘŁO SIĘ\nOD JEDNEJ\nDECYZJI.', 'Wstaw własną historię. Przeprowadź czytelnika przez moment, który coś zmienił.', 'DECYZJI.', 'light', 'creator-story'),
    story('WCZEŚNIEJ', 'TAK WYGLĄDAŁ\nPUNKT WYJŚCIA.', 'Opisz prawdziwą sytuację, z którą odbiorca może się utożsamić. Zamiast ogólników pokaż jeden moment.'),
    story('TRUDNOŚĆ', 'TO NIE SZŁO\nZGODNIE Z PLANEM.', 'Napisz, co konkretnie nie działało i jakie miało to konsekwencje. Zachowaj własny głos.', 'dark'),
    step('PUNKT ZWROTNY', 'ZMIENIŁEM\nJEDNĄ RZECZ.', 'Pokaż decyzję albo działanie, które rzeczywiście wpłynęło na dalszy bieg historii.'),
    story('LEKCJA', 'DZIŚ WIEM,\nŻE…', 'Podziel się wnioskiem, który czytelnik może odnieść do własnej sytuacji.', 'dark'),
    end('A JAK BYŁO\nU CIEBIE?', 'Zaproś do rozmowy jednym pytaniem związanym z historią.', 'Podziel się swoją historią'),
  ], 'male'),
  deck('creator-framework', 'Metoda w 3 krokach', 'creator-blue', '#2955ed', 'Prosty framework ekspercki. Każdy krok dostaje własny slajd i duży numer.', [
    poster('TWÓJ FRAMEWORK', 'OD CHAOSU\nDO PROSTEGO\nPLANU.', 'Trzy kroki, które pomagają uporządkować pracę. Dopasuj je do swojej metody.', 'PLANU.', 'accent'),
    step('KROK 01 · CEL', 'NAJPIERW\nWYBIERZ EFEKT.', 'Co ma się zmienić po wykonaniu zadania? Zapisz to jednym zdaniem.'),
    step('KROK 02 · RUCH', 'WYZNACZ\nNAJBLIŻSZY KROK.', 'Wybierz najmniejsze działanie, które przybliża Cię do tego efektu.', 'dark'),
    step('KROK 03 · OCENA', 'SPRAWDŹ,\nCO SIĘ ZMIENIŁO.', 'Porównaj wynik z celem. Zachowaj to, co pomaga, i popraw resztę.'),
    end('CEL. KROK.\nSPRAWDZENIE.', 'Zapisz schemat i wykorzystaj go przy najbliższym zadaniu.'),
  ]),
  deck('creator-save', 'Checklista do zapisania', 'creator-lime', '#c5f45b', 'Limonkowy akcent, czarne slajdy i duże punkty. Zestaw do praktycznych list kontrolnych.', [
    poster('PRZED PUBLIKACJĄ', 'ZAPISZ\nI SPRAWDŹ\nTE 5 RZECZY.', 'Krótka lista, do której możesz wracać przy każdej karuzeli.', 'ZAPISZ', 'accent'),
    step('SPRAWDŹ 01', 'CZY WIADOMO,\nDLA KOGO?', 'Pokaż konkretną potrzebę odbiorcy już na pierwszym slajdzie.'),
    step('SPRAWDŹ 02', 'CZY NAGŁÓWEK\nJEST CZYTELNY?', 'Otwórz projekt na telefonie. Sprawdź rozmiar liter i kontrast.', 'dark'),
    step('SPRAWDŹ 03', 'CZY JEST\nKONKRET?', 'Dodaj przykład, instrukcję albo własne doświadczenie zamiast samej ogólnej rady.'),
    step('SPRAWDŹ 04', 'CZY TREŚĆ\nJEST SPRAWDZONA?', 'Zweryfikuj dane, cytaty i obietnice. Usuń twierdzenia, których nie możesz uzasadnić.', 'dark'),
    step('SPRAWDŹ 05', 'CZY WIADOMO,\nCO DALEJ?', 'Poproś o jedno działanie związane z tematem i celem publikacji.'),
    end('GOTOWE?\nPUBLIKUJ.', 'Zachowaj listę i sprawdź ją przed kolejną publikacją.'),
  ]),
  deck('creator-opinion', 'Mocna opinia', 'creator-cream', '#db342d', 'Typograficzny manifest: teza, uzasadnienie, kontrast i krótka puenta.', [
    poster('POROZMAWIAJMY O TREŚCIACH', 'WIĘCEJ\nNIE ZNACZY\nLEPIEJ.', 'Moja perspektywa: warto zacząć od jakości decyzji, a nie od liczby publikacji.', 'LEPIEJ.', 'light'),
    story('TEZA', 'REGULARNOŚĆ\nPOTRZEBUJE CELU.', 'Sam harmonogram nie mówi jeszcze, czemu ma służyć treść. Nazwij jej rolę.'),
    compare('PRZESUŃ AKCENT', 'CO JESZCZE\nMOGĘ DZIŚ\nWRZUCIĆ?', 'W CZYM\nMOGĘ DZIŚ\nKOMUŚ POMÓC?'),
    story('W PRAKTYCE', 'MNIEJ TEMATÓW.\nWIĘCEJ KONKRETU.', 'Wybierz jeden problem i pokaż go na przykładzie, który odbiorca rozumie.', 'dark'),
    story('WAŻNE ZASTRZEŻENIE', 'TO PUNKT\nDO DYSKUSJI.', 'Różne marki mają różne potrzeby. Dopisz własny kontekst i doświadczenia.'),
    end('JAK TY\nTO WIDZISZ?', 'Zgadzasz się? Napisz dlaczego — również wtedy, gdy masz inne zdanie.', 'Dodaj swoją perspektywę'),
  ]),
  deck('creator-case', 'Case study eksperta', 'creator-lilac', '#c2a3f4', 'Projekt od wyzwania do efektu. Miejsce na własne dowody i rzeczywiste wyniki.', [
    poster('CASE STUDY · UZUPEŁNIJ', 'CO ZMIENIŁO\nTEN PROJEKT?', 'Pokaż własny proces, materiały i sprawdzone rezultaty. Bez wymyślonych statystyk.', 'PROJEKT?', 'light', 'creator-story'),
    story('KONTEKST', 'OD TEGO\nZACZĘLIŚMY.', 'Uzupełnij: branża, punkt wyjścia i najważniejsza potrzeba klienta.'),
    step('CEL', 'CO CHCIELIŚMY\nOSIĄGNĄĆ?', 'Wpisz konkretny cel i sposób, w jaki zamierzaliście ocenić rezultat.', 'dark'),
    compare('KLUCZOWA ZMIANA', 'WCZEŚNIEJ:\nUZUPEŁNIJ\nPUNKT WYJŚCIA.', 'PÓŹNIEJ:\nPOKAŻ\nWPROWADZONĄ ZMIANĘ.'),
    story('DOWÓD', 'WYNIK:\nUZUPEŁNIJ.', 'Dodaj rzeczywiste dane, okres pomiaru oraz kontekst. Możesz wstawić własny zrzut ekranu.', 'dark'),
    story('WNIOSEK', 'CO Z TEGO\nWYNIKA?', 'Wyjaśnij, czego nauczył Cię projekt i co z tego może wykorzystać odbiorca.'),
    end('MASZ PODOBNE\nWYZWANIE?', 'Napisz, z czym chcesz ruszyć dalej. Dopasujemy pierwszy krok.', 'Porozmawiajmy'),
  ], 'female'),
  deck('creator-launch', 'Premiera i oferta', 'creator-lilac', '#c2a3f4', 'Nowość z konkretną korzyścią, dopasowaniem do odbiorcy i czytelnym zaproszeniem.', [
    poster('PREMIERA · TWÓJ PRODUKT', 'NOWE\nMOŻLIWOŚCI.\nKONKRETNY CEL.', 'Wstaw nazwę oferty i opisz problem, który pomaga rozwiązać.', 'NOWE', 'accent', 'creator-portrait'),
    story('DLA KOGO?', 'CZY TO\nTWOJA SYTUACJA?', 'Opisz potrzebę i moment, w którym ta oferta ma sens dla odbiorcy.'),
    step('CO OTRZYMUJESZ', 'POKAŻ\nNAJWAŻNIEJSZE.', 'Wymień realny zakres produktu lub usługi. Połącz każdy element z jego zastosowaniem.', 'dark'),
    compare('OD POTRZEBY DO ROZWIĄZANIA', 'POTRZEBUJESZ:\nUZUPEŁNIJ\nPROBLEM.', 'OTRZYMUJESZ:\nUZUPEŁNIJ\nKONKRETNĄ POMOC.'),
    story('ZANIM ZDECYDUJESZ', 'SPRAWDŹ\nSZCZEGÓŁY.', 'Dodaj cenę, warunki, zakres i odpowiedź na najczęstsze pytanie. Użyj aktualnych informacji.', 'dark'),
    end('ZOBACZ, CZY\nTO DLA CIEBIE.', 'Pełne informacje o ofercie znajdziesz pod linkiem w bio.', 'Sprawdź ofertę w bio'),
  ], 'female'),
  deck('creator-before-after', 'Nagłówek: przed i po', 'creator-lime', '#c5f45b', 'Praktyczne porównania obok siebie: ogólny tekst i jego konkretniejsza wersja.', [
    poster('WARSZTAT PISANIA', 'TA SAMA MYŚL.\nJAŚNIEJSZY\nPRZEKAZ.', 'Zobacz trzy przykłady. Potem przerób w ten sposób własny nagłówek.', 'JAŚNIEJSZY', 'light'),
    compare('PRZYKŁAD 01 · KONKRET', 'PRZED:\nPORADY\nDLA FIRM.', 'PO:\n3 PYTANIA PRZED\nWYCENĄ USŁUGI.'),
    compare('PRZYKŁAD 02 · ODBIORCA', 'PRZED:\nLEPSZE\nZDJĘCIA.', 'PO:\nZDJĘCIA PRODUKTU\nPRZY OKNIE.'),
    compare('PRZYKŁAD 03 · SYTUACJA', 'PRZED:\nOSZCZĘDZAJ\nCZAS.', 'PO:\nPRZYGOTUJ PLAN\nPRZED SPOTKANIEM.'),
    step('TWOJA KOLEJ', 'USUŃ OGÓLNIK.\nDODAJ SYTUACJĘ.', 'Wybierz własny nagłówek. Dopisz odbiorcę, kontekst albo konkretną czynność.', 'dark'),
    end('JEDNA MYŚL.\nLEPSZE SŁOWA.', 'Zapisz te przykłady i wróć do nich podczas pisania.'),
  ]),
  deck('creator-webinar', 'Webinar eksperta', 'creator-red', '#f43d36', 'Zaproszenie z ekspertem, programem, informacjami organizacyjnymi i slajdem zapisów.', [
    poster('ZAPROSZENIE NA WEBINAR', 'JEDEN TEMAT.\nKONKRETNA\nWIEDZA.', 'Wstaw tytuł webinaru oraz to, z czym uczestnik wyjdzie ze spotkania.', 'WIEDZA.', 'dark', 'creator-portrait'),
    story('DLA KOGO?', 'TO SPOTKANIE\nJEST DLA CIEBIE,\nJEŚLI…', 'Opisz odbiorcę, jego potrzebę i to, na jakim etapie pracy przyda się webinar.'),
    step('PROGRAM', 'TEGO SIĘ\nDOWIESZ.', 'Wpisz trzy konkretne zagadnienia. Nie obiecuj rezultatów, których nie możesz zapewnić.', 'dark'),
    story('PROWADZĄCY', 'POZNAJ\nPROWADZĄCEGO.', 'Dodaj własne zdjęcie, imię i doświadczenie związane z tematem spotkania.'),
    story('INFORMACJE', 'KIEDY\nSIĘ WIDZIMY?', 'Data: uzupełnij\nGodzina i strefa: uzupełnij\nMiejsce / platforma: uzupełnij', 'dark'),
    end('DOŁĄCZ\nDO SPOTKANIA.', 'Wpisz sposób zapisów i warunki uczestnictwa. Link umieść w bio.', 'Sprawdź zapisy w bio'),
  ], 'male'),
];
