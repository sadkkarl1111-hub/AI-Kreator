type ToolGuide = {
  title: string;
  intro: string;
  steps: string[];
  tip: string;
  related: Array<{ href: string; label: string }>;
};

const TOOL_GUIDES: Record<string, ToolGuide> = {
  '/tools/mockup': {
    title: 'Jak zrobić mockup projektu online?',
    intro: 'Mockup pomaga pokazać klientowi, jak projekt będzie wyglądał na ekranie, opakowaniu albo produkcie. Możesz przygotować podgląd aplikacji na telefonie, okładki na książce lub logo na torbie.',
    steps: [
      'Wybierz nośnik, np. telefon, pudełko, koszulkę lub kubek. W modelach oznaczonych 3D możesz zmienić kąt, pozycję i tło studia.',
      'Wgraj grafikę. Wybierz „Cała grafika”, gdy ważne są krawędzie i napisy, albo „Wypełnij ramkę”, gdy projekt ma sięgać do jej brzegów.',
      'Pobierz jeden mockup jako PNG albo zaznacz kilka nośników w sekcji „Paczka mockupów”. Możesz dodać do ZIP-u wszystkie ujęcia wybranych modeli 3D.',
    ],
    tip: 'Przy opakowaniu użyj płaskiej grafiki frontu. Do podglądu logo na koszulce najlepiej nadaje się PNG z przezroczystym tłem.',
    related: [{ href: '/tools/text-effects', label: 'Zaprojektuj napis do mockupu' }, { href: '/tools/canvas-extender', label: 'Dopasuj proporcje grafiki' }],
  },
  '/tools/collage': {
    title: 'Jak zrobić kolaż zdjęć?',
    intro: 'Połącz zdjęcia z wydarzenia, pokaż detale produktu albo przygotuj zestawienie prac w jednej grafice. Układ kolażu określa, które zdjęcie otrzyma najwięcej miejsca.',
    steps: [
      'Wybierz układ, który pasuje do liczby zdjęć.',
      'Kliknij kolejne pola podglądu i dodaj do nich zdjęcia. W układzie siatki możesz dopasować odstępy i tło.',
      'Sprawdź kadr każdego zdjęcia i pobierz gotowy kolaż jako PNG.',
    ],
    tip: 'Do zestawienia produktu wybierz podobne oświetlenie i zbliżoną skalę na każdym zdjęciu. Zostaw jedno większe pole na ujęcie główne.',
    related: [{ href: '/tools/before-after', label: 'Porównaj zdjęcia przed i po' }, { href: '/tools/carousel-panorama', label: 'Podziel panoramę na slajdy' }],
  },
  '/tools/text-effects': {
    title: 'Jak zrobić napis z efektem 3D, neonu lub złota?',
    intro: 'Kreator napisów pozwala przygotować osobny element graficzny na miniaturę, plakat albo reklamę. Wpisz własny tekst i dopasuj styl do miejsca, w którym go użyjesz.',
    steps: [
      'Wpisz tekst i wybierz efekt, np. neon, złoto, obrys lub 3D.',
      'Dopasuj krój i kolory. Obejrzyj napis w podglądzie i sprawdź, czy jest czytelny także w małym rozmiarze.',
      'Pobierz PNG z przezroczystym tłem lub SVG do dalszej pracy w edytorze graficznym.',
    ],
    tip: 'Przezroczysty PNG przydaje się, gdy chcesz nałożyć napis na gotowe zdjęcie. Przy eksporcie SVG sprawdź wygląd kroju w aplikacji, w której otwierasz plik.',
    related: [{ href: '/tools/text', label: 'Dodaj tekst bezpośrednio na zdjęciu' }, { href: '/tools/mockup', label: 'Pokaż projekt na mockupie' }],
  },
  '/tools/compress': {
    title: 'Jak zoptymalizować zdjęcie do strony lub sklepu?',
    intro: 'Waga zdjęcia zależy m.in. od wymiarów w pikselach i jakości zapisu. Kompresor pozwala zmienić oba ustawienia i porównać wagę przed pobraniem.',
    steps: [
      'Wgraj zdjęcie i ustaw maksymalną szerokość odpowiednią do miejsca, w którym będzie wyświetlane.',
      'Obniż jakość JPG i sprawdź podgląd. Zwróć uwagę na drobny tekst i krawędzie produktu.',
      'Porównaj rozmiar plików i pobierz lżejszą wersję, jeśli podgląd wygląda dobrze.',
    ],
    tip: 'Kompresor zapisuje JPG. Gdy grafika ma zachować przezroczyste tło, wybierz osobny konwerter i zapisz plik jako PNG lub WebP.',
    related: [{ href: '/tools/batch-images', label: 'Zoptymalizuj wiele zdjęć naraz' }, { href: '/tools/shop-photo-audit', label: 'Sprawdź wagę i wymiary zdjęć do sklepu' }, { href: '/tools/format', label: 'Zmień format na PNG lub WebP' }],
  },
  '/tools/meme': {
    title: 'Jak zrobić mem z własnego zdjęcia?',
    intro: 'Generator memów pozwala użyć gotowego szablonu albo własnego zdjęcia. Tekst możesz dopasować do obrazu i sprawdzić, jak będzie wyglądał przed wysłaniem.',
    steps: [
      'Wybierz szablon lub wgraj zdjęcie.',
      'Wpisz tekst w polach szablonu i dobierz rozmiar oraz kolor napisu. Sprawdź czytelność na jasnych i ciemnych fragmentach zdjęcia.',
      'Pobierz mem jako PNG i udostępnij go tam, gdzie chcesz.',
    ],
    tip: 'Krótki napis z wyraźnym obrysem będzie łatwiejszy do odczytania w podglądzie komunikatora.',
    related: [{ href: '/tools/text-effects', label: 'Utwórz napis z efektem' }, { href: '/tools/gif-maker', label: 'Zrób GIF z własnych zdjęć' }],
  },
  '/tools/svg-library': {
    title: 'Jak znaleźć i pobrać ikonę SVG?',
    intro: 'Biblioteka ikon pozwala szybko znaleźć symbole do przycisków, prezentacji i materiałów reklamowych. Plik wektorowy możesz skalować bez utraty ostrości.',
    steps: [
      'Wpisz nazwę ikony albo wybierz kategorię i przejrzyj wyniki.',
      'Dopasuj kolor oraz rozmiar ikony do projektu.',
      'Pobierz SVG i wstaw plik do projektu lub na stronę.',
    ],
    tip: 'Jeśli kompletujesz zestaw ikon do jednego projektu, używaj zbliżonej grubości linii i zostaw tyle samo wolnego miejsca wokół symboli.',
    related: [{ href: '/tools/vectorize', label: 'Zamień własną ikonę PNG na SVG' }, { href: '/tools/badges', label: 'Zobacz gotowe badge’e reklamowe' }],
  },
};

export function getToolGuide(pathname: string): ToolGuide | undefined {
  return TOOL_GUIDES[pathname.replace(/\/+$/, '')];
}
