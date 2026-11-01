import { BLOG_ARTICLES, type BlogArticle } from '../content/blog.ts';

export const SITE_URL = 'https://ai-kreator.pl';
export const SITE_NAME = 'Kreator Grafik AI';
export const DEFAULT_IMAGE = '/demo-assets/ad-example-ai-v2.webp';
export const SEO_ALIASES: Record<string, string> = {
  '/terms': '/regulamin',
  '/privacy': '/polityka-prywatnosci',
};

export type SeoPage = {
  path: string;
  heading: string;
  title: string;
  description: string;
  image?: string;
  article?: BlogArticle;
};

const page = (path: string, heading: string, description: string): SeoPage => ({
  path, heading, title: `${heading} | ${SITE_NAME}`, description,
});

// Only pages that a guest can actually open belong in the sitemap.
export const PUBLIC_SEO_PAGES: SeoPage[] = [
  page('/', 'Generator grafik AI i darmowe narzędzia graficzne', 'Twórz grafiki reklamowe i mockupy z AI. Korzystaj z darmowego kreatora karuzel, generatora promptów, ikon i edycji zdjęć online. Generowanie obrazów AI jest płatne.'),
  page('/tools', 'Darmowe narzędzia graficzne online i narzędzia AI', 'Edytuj zdjęcia, twórz karuzele, napisy, kody QR i pliki SVG w przeglądarce. Zobacz darmowe narzędzia oraz funkcje AI rozliczane kredytami.'),
  page('/galeria-publiczna', 'Galeria grafik AI i inspiracje reklamowe', 'Zobacz przykładowe grafiki reklamowe, mockupy i obrazy wygenerowane przez AI. Znajdź inspiracje do własnych reklam i postów w mediach społecznościowych.'),
  page('/tools/carousel', 'Darmowy kreator karuzel na Instagram', 'Twórz karuzele z własnym logo, tekstem, zdjęciami i naklejkami. Wybieraj szablony i pobieraj slajdy jako PNG, ZIP lub PDF. Dodatkowe generowanie AI jest płatne.'),
  page('/tools/prompt-generator', 'Darmowy Generator Promptów Pro do grafik AI', 'Zbuduj prompt do reklamy, mockupu ebooka, okładki, posta lub miniatury YouTube. Generator działa bez kredytów; tworzenie obrazów AI rozliczane jest osobno.'),
  page('/tools/emoji', 'Elementy reklamowe, emoji i strzałki do pobrania', 'Wyszukuj emoji, strzałki, symbole i elementy do reklam, webinarów oraz karuzel. Wybierz gotową paczkę i przygotuj materiały do swoich projektów.'),
  page('/tools/gifs', 'Darmowe animowane GIF-y do czatów i pobrania', 'Wybierz GIF z polskim napisem: dzięki, brawo, dzień dobry i inne reakcje. Kopiuj linki lub pobieraj animacje bez logowania, opłat i kredytów.'),
  page('/tools/badges', 'Badge’e reklamowe: promocje, gwarancje i bonusy', 'Przeglądaj badge’e do reklam: promocje, gwarancja zwrotu, webinar i pakiety bonusów. Pobieraj elementy z przezroczystym tłem. Część wymaga pakietu.'),
  page('/tools/svg-library', 'Darmowa biblioteka ikon i grafik SVG', 'Wyszukuj ikony i grafiki wektorowe, zmieniaj ich kolory i pobieraj pliki SVG. Przygotuj elementy do strony, reklamy lub prezentacji.'),
  page('/tools/svg-generator', 'Generator SVG z opisu tekstowego AI', 'Opisz ikonę lub prostą ilustrację i wygeneruj grafikę SVG z AI. Dopasuj format i tło, a wynik pobierz jako SVG lub PNG. Funkcja AI wymaga płatnego dostępu.'),
  page('/tools/vectorize', 'PNG i JPG na SVG — darmowa wektoryzacja online', 'Zamień obraz PNG lub JPG na grafikę wektorową SVG. Dopasuj ustawienia i pobierz wynik. Konwersja odbywa się lokalnie w przeglądarce, bez kredytów AI.'),
  page('/tools/text-effects', 'Generator napisów 3D, neonowych i złotych', 'Twórz napisy z efektami 3D, neonu i złota. Ustaw tekst, krój i kolory, a następnie pobierz SVG lub PNG z przezroczystym tłem bez kredytów AI.'),
  page('/tools/batch-images', 'Edycja wielu zdjęć online — kompresja i znak wodny', 'Przetwarzaj wiele zdjęć naraz: zmniejszaj pliki, zmieniaj format i dodawaj znak wodny z tekstu lub logo. Pobierz gotową paczkę ZIP.'),
  page('/tools/print-preparation', 'Przygotowanie grafiki do druku online', 'Dopasuj rozmiar grafiki w milimetrach, rozdzielczość i spady do projektu do druku. Przygotuj plik do dalszej pracy i sprawdź jego parametry.'),
  page('/tools/crop', 'Darmowe kadrowanie zdjęć online', 'Przytnij zdjęcie do wybranych proporcji w przeglądarce. Dopasuj kadr do posta, reklamy lub własnego projektu i pobierz gotowy obraz.'),
  page('/tools/filters', 'Filtry do zdjęć i korekta kolorów online', 'Zmieniaj jasność, kontrast i nasycenie zdjęcia z podglądem na żywo. Nakładaj filtry i pobieraj poprawione grafiki bez kredytów AI.'),
  page('/tools/text', 'Dodaj tekst do zdjęcia online', 'Dodawaj napisy do własnych zdjęć. Dobieraj czcionki, kolory, cienie i obrót tekstu, a następnie pobierz gotową grafikę.'),
  page('/tools/collage', 'Darmowy kreator kolaży ze zdjęć', 'Połącz kilka zdjęć w jedną grafikę. Wybierz układ kolażu, dodaj własne obrazy i przygotuj kompozycję do publikacji lub pobrania.'),
  page('/tools/watermark', 'Dodaj znak wodny do zdjęcia online', 'Zabezpiecz zdjęcie podpisem tekstowym lub graficznym znakiem wodnym. Dopasuj wygląd i położenie oznaczenia, a następnie pobierz plik.'),
  page('/tools/meme', 'Darmowy generator memów online', 'Stwórz mem z gotowego szablonu lub własnego zdjęcia. Dodaj tekst, dopasuj wygląd napisów i pobierz obraz do publikacji.'),
  page('/tools/mockup', 'Darmowy generator mockupów online', 'Umieść własną grafikę na mockupie telefonu, laptopa, koszulki lub innego nośnika. Przygotuj podgląd projektu bez generowania obrazów AI.'),
  page('/tools/social-resize', 'Zmiana rozmiaru grafik do social mediów', 'Dopasuj grafikę do formatów Instagram, YouTube, LinkedIn i innych platform. Przygotuj kilka rozmiarów do swoich postów i materiałów reklamowych.'),
  page('/tools/color-palette', 'Generator palety kolorów ze zdjęcia', 'Wczytaj zdjęcie i odczytaj jego dominujące kolory. Przygotuj paletę do grafik reklamowych, marki, strony internetowej lub prezentacji.'),
  page('/tools/format', 'Konwerter PNG, JPG i WebP online', 'Zmieniaj format zdjęć i grafik między PNG, JPG oraz WebP. Wczytaj własny plik, wybierz format wyjściowy i pobierz skonwertowany obraz.'),
  page('/tools/compress', 'Darmowa kompresja zdjęć online', 'Zmniejsz rozmiar zdjęcia z regulacją jakości i podglądem efektu. Przygotuj lżejsze pliki do strony internetowej, sklepu lub publikacji.'),
  page('/tools/pdf', 'Zdjęcia do PDF — darmowy konwerter online', 'Połącz wiele zdjęć w jeden dokument PDF. Wczytaj obrazy, ustaw ich kolejność i pobierz gotowy plik bez kredytów AI.'),
  page('/tools/flip', 'Odbicie lustrzane zdjęcia online', 'Odbij zdjęcie poziomo lub pionowo w przeglądarce. Przygotuj lustrzaną wersję obrazu i pobierz plik bez kredytów AI.'),
  page('/tools/qrcode', 'Darmowy generator kodów QR z logo', 'Twórz kody QR, dobieraj kolory i dodawaj własne logo. Pobieraj gotowy kod jako SVG lub PNG do materiałów drukowanych i internetowych.'),
  page('/blog', 'Blog o grafikach AI, promptach i reklamach', 'Praktyczne poradniki o tworzeniu grafik AI, pisaniu promptów, mockupach ebooków i formatach social media. Poznaj narzędzia Kreatora Grafik AI.'),
  page('/regulamin', 'Regulamin serwisu', 'Przeczytaj zasady korzystania z Kreatora Grafik AI, warunki konta, zakupu kredytów i korzystania z funkcji serwisu.'),
  page('/polityka-prywatnosci', 'Polityka prywatności', 'Dowiedz się, jak Kreator Grafik AI przetwarza dane osobowe, obsługuje pliki cookies i realizuje prawa użytkowników dotyczące prywatności.'),
  ...BLOG_ARTICLES.map((article) => ({
    ...page(`/blog/${article.slug}`, article.title, article.description),
    image: article.coverImage,
    article,
  })),
];

export const PRIVATE_PATHS = [
  '/auth', '/auth/callback', '/reset-password', '/dashboard', '/generator',
  '/tools/editor', '/tools/badge-editor', '/tools/remove-bg', '/tools/upscale',
  '/tools/style', '/tools/colorize', '/tools/outpainting', '/tools/variants',
  '/tools/logo', '/tools/ocr', '/tools/image-to-prompt', '/tools/background-replace',
  '/generator-reklam', '/editor', '/templates', '/company-assistant', '/gallery',
  '/credits', '/whatsapp', '/admin', '/profile',
];

export function getSeoPage(pathname: string): SeoPage | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_SEO_PAGES.find((entry) => entry.path === (SEO_ALIASES[path] || path));
}

export function seoStructuredData(entry: SeoPage) {
  const url = `${SITE_URL}${entry.path === '/' ? '/' : entry.path}`;
  const organization = { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: `${SITE_URL}/` };
  const nodes: Record<string, unknown>[] = [organization, {
    '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE_NAME,
    inLanguage: 'pl-PL', publisher: { '@id': organization['@id'] },
  }, {
    '@type': entry.article ? 'Article' : entry.path === '/blog' ? 'CollectionPage' : 'WebPage',
    '@id': `${url}#page`, url, name: entry.heading, description: entry.description,
    inLanguage: 'pl-PL', isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(entry.article ? {
      headline: entry.article.title,
      image: `${SITE_URL}${entry.image}`,
      mainEntityOfPage: url,
      publisher: { '@id': organization['@id'] },
    } : {}),
  }];
  if (entry.path !== '/') nodes.push({
    '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      ...(entry.path.startsWith('/tools/') ? [{ '@type': 'ListItem', position: 2, name: 'Narzędzia', item: `${SITE_URL}/tools` }] : []),
      ...(entry.article ? [{ '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` }] : []),
      { '@type': 'ListItem', position: entry.path.startsWith('/tools/') || entry.article ? 3 : 2, name: entry.heading, item: url },
    ],
  });
  return { '@context': 'https://schema.org', '@graph': nodes };
}
