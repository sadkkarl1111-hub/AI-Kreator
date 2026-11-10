import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpFromLine,
  Award,
  BadgeCheck,
  Copy,
  Crop,
  Expand,
  FileText,
  FileType,
  FlipHorizontal2,
  Film,
  Code2,
  Heart,
  Hexagon,
  Image as ImageIcon,
  Laugh,
  LayoutGrid,
  Lock,
  Minimize2,
  Monitor,
  Paintbrush,
  Palette,
  PenLine,
  Pipette,
  QrCode,
  ScanText,
  Scissors,
  Shapes,
  Smile,
  Sparkles,
  Stamp,
  Sun,
  Type,
  Wand2,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useFavoriteTools } from '@/hooks/useFavoriteTools';
import { useAuth } from '@/hooks/useAuth';
import { vpsPublicFetch } from '@/lib/vpsApi';

const tools = [
  { to: '/tools/product-recolor', icon: Palette, label: 'Podmiana koloru produktu AI', desc: 'Zamaluj materiał i przygotuj wariant kolorystyczny z zachowaniem faktury i cieni.', color: 'from-fuchsia-500 to-violet-600', credits: true },
  { to: '/tools/ad-photo', icon: ImageIcon, label: 'Zdjęcie reklamowe z miejscem na tekst', desc: 'Wybierz scenerię i stronę na nagłówek oraz cenę. AI przygotuje zdjęcie produktu do reklamy.', color: 'from-indigo-500 to-blue-600', credits: true },
  { to: '/tools/canvas-extender', icon: Expand, label: 'Rozszerzanie płótna zdjęcia', desc: 'Dopasuj zdjęcie do posta, relacji albo banera. Uzupełnij brzegi kolorem, rozmyciem lub przezroczystością.', color: 'from-teal-500 to-cyan-600', credits: false },
  { to: '/tools/shop-photo-audit', icon: ScanText, label: 'Kontrola zdjęć do sklepu', desc: 'Sprawdź wymiary, proporcje i wagę paczki zdjęć według wymagań swojego sklepu.', color: 'from-emerald-500 to-teal-600', credits: false },
  { to: '/tools/photo-redaction', icon: Lock, label: 'Zasłoń dane na zdjęciu', desc: 'Zasłoń adres, numer telefonu lub twarz pełnym kolorem i pobierz gotowy PNG.', color: 'from-slate-500 to-indigo-600', credits: false },
  { to: '/tools/gif-maker', icon: Film, label: 'Kreator GIF ze zdjęć', desc: 'Ułóż do 12 zdjęć, ustaw tempo i pobierz zapętloną animację GIF.', color: 'from-pink-500 to-purple-600', credits: false },
  { to: '/tools/remove-object', icon: Paintbrush, label: 'Usuwanie obiektów AI', desc: 'Zamaluj osobę lub przedmiot, a AI uzupełni zaznaczony fragment zdjęcia.', color: 'from-violet-500 to-indigo-600', credits: true },
  { to: '/tools/before-after', icon: ImageIcon, label: 'Porównanie przed i po', desc: 'Porównaj dwa zdjęcia suwakiem i pobierz oba obok siebie jako PNG.', color: 'from-cyan-500 to-blue-600', credits: false },
  { to: '/tools/carousel-panorama', icon: LayoutGrid, label: 'Karuzela z jednego zdjęcia', desc: 'Podziel panoramę na 2–6 ciągłych slajdów. Pobierz ZIP lub opcjonalnie poszerz zdjęcie z AI po zalogowaniu.', color: 'from-sky-500 to-violet-600', credits: false },
  { to: '/tools/rounded-corners', icon: ImageIcon, label: 'Zaokrąglanie rogów', desc: 'Zaokrąglij zdjęcie lub wytnij je w koło. Pobierz PNG z przezroczystym tłem.', color: 'from-sky-500 to-cyan-600', credits: false },
  { to: '/tools/photo-frame', icon: ImageIcon, label: 'Cień i ramka', desc: 'Dodaj kolorową ramkę, margines i miękki cień do zdjęcia lub zrzutu ekranu.', color: 'from-violet-500 to-indigo-600', credits: false },
  { to: '/tools/image-tiles', icon: LayoutGrid, label: 'Podziel zdjęcie na kafelki', desc: 'Podziel zdjęcie na siatkę i pobierz ponumerowane kafelki PNG w ZIP.', color: 'from-emerald-500 to-teal-600', credits: false },
  { to: '/tools/product-photos', icon: ImageIcon, label: 'Zdjęcia produktowe AI', desc: 'Wgraj produkt i wybierz studio, marmur, naturę lub inną scenerię. Wygeneruj zdjęcie do sklepu i reklamy.', color: 'from-sky-500 to-indigo-600', credits: true },
  { to: '/tools/widgets', icon: Code2, label: 'Liczniki i paski na stronę', desc: 'Odliczanie do wydarzenia, wolne miejsca i postęp. Ustaw harmonogram i skopiuj gotowy kod HTML.', color: 'from-cyan-500 to-violet-600', credits: false },
  { to: '/tools/gifs', icon: Film, label: 'Animowane GIF-y i emoji', desc: 'Ruchome emoji i polskie reakcje. Pobierz MP4 do WhatsApp lub GIF z animacją.', color: 'from-pink-500 to-violet-600', credits: false },
  { to: '/tools/batch-images', icon: Copy, label: 'Edycja wielu zdjęć', desc: 'Kompresja, zmiana formatu oraz znak wodny z tekstu lub logo dla całej paczki. Pobierz ZIP.', color: 'from-cyan-500 to-blue-600', credits: false },
  { to: '/tools/carousel', icon: LayoutGrid, label: 'Kreator karuzel', desc: 'Dodaj logo marki, tła i style: gazeta, 3D, magazyn. Pobierz slajdy jako PNG, ZIP lub PDF.', color: 'from-violet-500 to-indigo-600', credits: false },
  { to: '/tools/print-preparation', icon: FileText, label: 'Przygotowanie do druku', desc: 'Ustaw rozmiar w milimetrach, spady i znaczniki cięcia. Sprawdź jakość i pobierz PDF.', color: 'from-sky-500 to-teal-600', credits: false },
  { to: '/tools/vectorize', icon: Shapes, label: 'PNG / JPG → SVG', desc: 'Zamień logo, ikonę lub prosty rysunek w wektory. Lokalnie, bez AI i kredytów.', color: 'from-emerald-500 to-sky-600', credits: false },
  { to: '/tools/text-effects', icon: Type, label: 'Kreator napisów z efektami', desc: 'Efekty 3D, neon, złoto i obrys. Pobierz napis jako SVG lub PNG z przezroczystym tłem.', color: 'from-amber-500 to-rose-600', credits: false },
  { to: '/tools/svg-generator', icon: Shapes, label: 'Generator SVG z prompta', desc: 'Opisz ikonę, ilustrację lub proste logo. AI stworzy grafikę za kredyty, do pobrania w SVG i PNG.', color: 'from-violet-500 to-sky-500', credits: true },
  { to: '/tools/svg-library', icon: Shapes, label: 'Biblioteka SVG', desc: 'Darmowe ikony i grafiki wektorowe. Wyszukuj, zmieniaj kolor i pobieraj SVG.', color: 'from-teal-500 to-cyan-600', credits: false },
  { to: '/tools/prompt-generator', icon: PenLine, label: 'Generator Promptów Pro', desc: 'Zbuduj gotowy prompt do reklamy, mockupu, okładki, posta albo banera bez kredytów.', color: 'from-fuchsia-500 to-sky-500', credits: false },
  { to: '/tools/editor', icon: Paintbrush, label: 'Edytor AI', desc: 'Zamaluj obszar pędzlem i opisz zmiany, a AI zmodyfikuje obraz.', color: 'from-violet-500 to-purple-600', credits: true },
  { to: '/tools/badge-editor', icon: BadgeCheck, label: 'Edytor badge’ów AI', desc: 'Zmień napis lub usuń wybrany element z gotowego badge’a.', color: 'from-purple-500 to-fuchsia-600', credits: true },
  { to: '/tools/remove-bg', icon: Scissors, label: 'Usuń tło', desc: 'Automatycznie usuń tło z grafiki. Darmowa opcja lub AI.', color: 'from-emerald-500 to-teal-600', credits: null },
  { to: '/tools/background-replace', icon: ImageIcon, label: 'Background Replace', desc: 'Podmień samo tło bez ruszania osoby, produktu albo głównego obiektu.', color: 'from-green-500 to-lime-600', credits: true },
  { to: '/tools/upscale', icon: ArrowUpFromLine, label: 'Powiększ (Upscale)', desc: 'Zwiększ rozdzielczość obrazu z pomocą AI.', color: 'from-blue-500 to-cyan-600', credits: true },
  { to: '/tools/style', icon: Sparkles, label: 'Zmiana stylu', desc: 'Przeróbka na anime, oil painting, watercolor i inne style.', color: 'from-indigo-500 to-violet-600', credits: true },
  { to: '/tools/colorize', icon: Sun, label: 'Koloryzacja B&W', desc: 'Pokoloruj czarno-białe zdjęcia za pomocą AI.', color: 'from-yellow-500 to-orange-500', credits: true },
  { to: '/tools/outpainting', icon: Expand, label: 'Rozszerzanie obrazu', desc: 'AI dorysuje brakujące fragmenty poza krawędziami.', color: 'from-teal-500 to-emerald-600', credits: true },
  { to: '/tools/variants', icon: Copy, label: 'Warianty obrazu', desc: 'Generuj różne wersje istniejącego obrazu.', color: 'from-fuchsia-500 to-pink-600', credits: true },
  { to: '/tools/logo', icon: Hexagon, label: 'Logo Maker', desc: 'Wygeneruj logo dla swojej marki z pomocą AI.', color: 'from-cyan-500 to-blue-600', credits: true },
  { to: '/tools/ocr', icon: ScanText, label: 'OCR - Tekst ze zdjęcia', desc: 'Wyciągnij tekst z obrazu za pomocą AI. Obsługuje polskie znaki.', color: 'from-violet-500 to-indigo-600', credits: true },
  { to: '/tools/image-to-prompt', icon: FileText, label: 'Image to Prompt', desc: 'Zamień obraz referencyjny w gotowy prompt do dalszej generacji.', color: 'from-sky-500 to-cyan-600', credits: true },
  { to: '/tools/crop', icon: Crop, label: 'Kadrowanie', desc: 'Przytnij obraz do wybranej proporcji. Darmowe.', color: 'from-amber-500 to-orange-600', credits: false },
  { to: '/tools/filters', icon: Palette, label: 'Filtry i korekty', desc: 'Jasność, kontrast i nasycenie z podglądem na żywo.', color: 'from-pink-500 to-rose-600', credits: false },
  { to: '/tools/text', icon: Type, label: 'Tekst na obrazie', desc: 'Dodaj napisy z fontami, kolorami, cieniami i obrotami.', color: 'from-sky-500 to-blue-600', credits: false },
  { to: '/tools/collage', icon: LayoutGrid, label: 'Kolaż zdjęć', desc: 'Połącz wiele zdjęć w jeden obraz z gotowymi układami.', color: 'from-lime-500 to-green-600', credits: false },
  { to: '/tools/watermark', icon: Stamp, label: 'Watermark', desc: 'Dodaj znak wodny jako tekst lub podpis graficzny.', color: 'from-slate-500 to-gray-600', credits: false },
  { to: '/tools/meme', icon: Laugh, label: 'Meme Generator', desc: 'Twórz memy z szablonami albo własnymi zdjęciami.', color: 'from-orange-500 to-red-500', credits: false },
  { to: '/tools/mockup', icon: Monitor, label: 'Generator mockupów', desc: 'Pokaż jeden projekt na kilku nośnikach. Pobierz mockupy jako osobne PNG lub razem w ZIP-ie.', color: 'from-purple-500 to-indigo-600', credits: false },
  { to: '/tools/social-resize', icon: LayoutGrid, label: 'Smart Resize Social', desc: 'Dopasuj jedną grafikę do formatów Instagram, YouTube, LinkedIn i innych.', color: 'from-orange-500 to-amber-600', credits: false },
  { to: '/tools/color-palette', icon: Pipette, label: 'Paleta kolorów', desc: 'Wyciągnij dominujące kolory ze zdjęcia.', color: 'from-rose-500 to-pink-600', credits: false },
  { to: '/tools/format', icon: FileType, label: 'Zmiana formatu i rozmiaru', desc: 'Konwertuj PNG, JPG i WebP oraz zmniejszaj wymiary obrazów.', color: 'from-green-500 to-emerald-600', credits: false },
  { to: '/tools/compress', icon: Minimize2, label: 'Kompresja i optymalizacja zdjęć', desc: 'Zmniejsz wagę JPG i porównaj rozmiar przed pobraniem.', color: 'from-blue-500 to-indigo-500', credits: false },
  { to: '/tools/pdf', icon: FileText, label: 'Obrazy do PDF', desc: 'Połącz wiele zdjęć w jeden plik PDF.', color: 'from-red-500 to-rose-600', credits: false },
  { to: '/tools/flip', icon: FlipHorizontal2, label: 'Odbicie (Flip)', desc: 'Odbij obraz w pionie lub poziomie. Darmowe.', color: 'from-cyan-500 to-teal-600', credits: false },
  { to: '/tools/qrcode', icon: QrCode, label: 'QR Code', desc: 'Generuj kody QR z kolorami, logo i eksportem SVG lub PNG.', color: 'from-gray-600 to-zinc-700', credits: false },
  { to: '/tools/emoji', icon: Smile, label: 'Elementy reklamowe', desc: 'Paczki do reklam, checkmarki, strzałki, symbole i wyszukiwanie po znaczeniu.', color: 'from-yellow-500 to-amber-600', credits: false },
  { to: '/tools/badges', icon: Award, label: 'Baza badge’ów', desc: 'Gotowe badge’e do pobrania: Free, Bestseller, Gwarancja i inne.', color: 'from-rose-500 to-red-600', credits: false },
] as const;

const getToolId = (to: string) => to.replace('/tools/', '');
const getGuestHref = (to: string) => `/auth?returnTo=${encodeURIComponent(to)}`;

type ToolCardProps = {
  tool: (typeof tools)[number];
  isFavorite: boolean;
  canFavorite: boolean;
  isGuest: boolean;
  onToggleFavorite: (toolId: string) => void;
  delay: number;
};

const ToolCard = ({ tool, isFavorite, canFavorite, isGuest, onToggleFavorite, delay }: ToolCardProps) => {
  const toolId = getToolId(tool.to);
  const requiresAccount = tool.credits !== false;
  const href = isGuest && requiresAccount ? getGuestHref(tool.to) : tool.to;

  const badgeClass =
    tool.credits === false
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : tool.credits === null
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-primary/10 text-primary';

  const badgeText =
    tool.credits === false
      ? 'Darmowe'
      : tool.credits === null
        ? 'Darmowe + AI'
        : isGuest ? 'Płatne - zaloguj' : 'Płatne';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Link to={href}>
        <Card className="group cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] h-full relative">
          <CardContent className="pt-6 pb-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-lg`}>
                <tool.icon className="w-6 h-6 text-white" />
              </div>
              {canFavorite && (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleFavorite(toolId);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isFavorite
                        ? 'fill-red-500 text-red-500'
                        : 'text-muted-foreground/40 hover:text-muted-foreground'
                    }`}
                  />
                </button>
              )}
              {!canFavorite && requiresAccount && <Lock className="w-4 h-4 text-muted-foreground/60" />}
            </div>
            <div>
              <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                {tool.label}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tool.desc}</p>
            </div>
            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
              {badgeText}
            </span>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};

const Tools = () => {
  const { user } = useAuth();
  const { favorites, toggleFavorite } = useFavoriteTools();
  const [hiddenToolIds, setHiddenToolIds] = useState<Set<string>>(new Set());
  const isGuest = !user;

  useEffect(() => {
    vpsPublicFetch<{ ok?: boolean; tools?: Array<{ tool_id: string; active: boolean; visible: boolean }> }>('/public/tool-pricing')
      .then(({ tools: data }) => {
        if (!data) return;

        const hidden = new Set<string>();
        for (const tool of data) {
          if (!tool.active || !tool.visible) {
            hidden.add(tool.tool_id);
          }
        }

        setHiddenToolIds(hidden);
      });
  }, []);

  const visibleTools = useMemo(() => {
    const visible = tools.filter((tool) => !hiddenToolIds.has(getToolId(tool.to)));
    if (user) return visible;

    return [...visible].sort((a, b) => {
      const getRank = (tool: (typeof tools)[number]) => tool.credits === false ? 0 : tool.credits === null ? 1 : 2;
      return getRank(a) - getRank(b);
    });
  }, [hiddenToolIds, user]);

  const favoriteTools = user ? visibleTools.filter((tool) => favorites.includes(getToolId(tool.to))) : [];
  const otherTools = user ? visibleTools.filter((tool) => !favorites.includes(getToolId(tool.to))) : visibleTools;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            <Wand2 className="inline w-6 h-6 text-primary mr-2" />
            Narzędzia <span className="gradient-text">AI</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Kompletny zestaw narzędzi do edycji, ulepszania i przygotowywania grafik.
          </p>
        </div>

        {favoriteTools.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Heart className="w-4 h-4 fill-red-500 text-red-500" /> Ulubione
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {favoriteTools.map((tool, index) => (
                <ToolCard
                  key={tool.to}
                  tool={tool}
                  isFavorite
                  canFavorite={Boolean(user)}
                  isGuest={isGuest}
                  onToggleFavorite={toggleFavorite}
                  delay={index * 0.02}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {favoriteTools.length > 0 && (
            <h2 className="text-sm font-semibold text-muted-foreground">Wszystkie narzędzia</h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {otherTools.map((tool, index) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                isFavorite={favorites.includes(getToolId(tool.to))}
                canFavorite={Boolean(user)}
                isGuest={isGuest}
                onToggleFavorite={toggleFavorite}
                delay={index * 0.03}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Tools;
