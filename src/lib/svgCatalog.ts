import { WORK_SVG_GROUPS } from './workSvgIcons';
import {
  ArrowRight, ArrowDown, ArrowUp, ArrowLeft, MoveUpRight, Check, CircleCheck,
  X, Plus, Minus, Search, Menu, Settings, Home, User, Users, Heart, Star, Smile,
  ThumbsUp, MessageCircle, Send, Share2, Bell, Mail, Phone, Smartphone,
  Camera, Image, Play, Music, Video, Mic, ShoppingCart, ShoppingBag, Store,
  Tag, Percent, Gift, CreditCard, Wallet, Receipt, Package, Truck, BadgeCheck,
  ShieldCheck, Lock, KeyRound, Award, Crown, Gem, Zap, Flame, Sparkles,
  Megaphone, Target, TrendingUp, ChartNoAxesCombined, BriefcaseBusiness,
  Calendar, Clock, MapPin, Globe, Link, Download, Upload, FileText, Folder,
  Cloud, Sun, Moon, Leaf, Flower2, TreePine, Mountain, Coffee, Utensils,
  Rocket, Lightbulb, Palette, Pencil, Scissors, BookOpen, GraduationCap,
  type LucideIcon,
} from 'lucide-react';

export type SvgIconItem = { id: string; name: string; category: string; keywords: string; icon: LucideIcon };
type IconEntry = [string, string, LucideIcon, string];
const groups: Array<{ category: string; items: IconEntry[] }> = [
  { category: 'Strzałki i interfejs', items: [
    ['arrow-right', 'Strzałka w prawo', ArrowRight, 'dalej kierunek right'], ['arrow-left', 'Strzałka w lewo', ArrowLeft, 'wstecz left'],
    ['arrow-up', 'Strzałka w górę', ArrowUp, 'up'], ['arrow-down', 'Strzałka w dół', ArrowDown, 'down'],
    ['move-up-right', 'Strzałka po skosie', MoveUpRight, 'wzrost'], ['check', 'Zaznaczenie', Check, 'check ptaszek tak potwierdzenie'],
    ['circle-check', 'Potwierdzenie', CircleCheck, 'check sukces gotowe'], ['x', 'Zamknij', X, 'krzyżyk anuluj'],
    ['plus', 'Plus', Plus, 'dodaj'], ['minus', 'Minus', Minus, 'usuń'], ['search', 'Szukaj', Search, 'lupa'],
    ['menu', 'Menu', Menu, 'hamburger'], ['settings', 'Ustawienia', Settings, 'koło zębate'], ['home', 'Dom', Home, 'strona główna house'],
    ['download', 'Pobieranie', Download, 'download zapisz'], ['upload', 'Przesyłanie', Upload, 'upload'],
  ] },
  { category: 'Marketing i sprzedaż', items: [
    ['shopping-cart', 'Koszyk', ShoppingCart, 'sklep zakupy cart'], ['shopping-bag', 'Torba zakupowa', ShoppingBag, 'sklep zakupy bag'],
    ['store', 'Sklep', Store, 'handel'], ['tag', 'Etykieta', Tag, 'cena metka'], ['percent', 'Rabat', Percent, 'zniżka promocja procent sale'],
    ['gift', 'Prezent', Gift, 'bonus upominek'], ['credit-card', 'Karta płatnicza', CreditCard, 'płatność'], ['wallet', 'Portfel', Wallet, 'pieniądze'],
    ['receipt', 'Paragon', Receipt, 'rachunek'], ['package', 'Paczka', Package, 'pudełko produkt'], ['truck', 'Dostawa', Truck, 'transport wysyłka'],
    ['megaphone', 'Megafon', Megaphone, 'reklama marketing'], ['target', 'Cel', Target, 'tarcza target'], ['trending-up', 'Wzrost', TrendingUp, 'statystyki zysk'],
    ['chart', 'Wykres', ChartNoAxesCombined, 'analiza dane'], ['flame', 'Ogień', Flame, 'hot popularne'], ['zap', 'Błyskawica', Zap, 'szybkość energia'],
  ] },
  { category: 'Social media i kontakt', items: [
    ['heart', 'Serce', Heart, 'miłość like heart'], ['star', 'Gwiazda', Star, 'ocena ulubione'], ['smile', 'Uśmiech', Smile, 'radość emoji'],
    ['thumbs-up', 'Lubię to', ThumbsUp, 'kciuk like polecam'], ['message-circle', 'Wiadomość', MessageCircle, 'czat komentarz'],
    ['send', 'Wyślij', Send, 'samolot wiadomość'], ['share', 'Udostępnij', Share2, 'share'], ['bell', 'Powiadomienie', Bell, 'dzwonek'],
    ['mail', 'E-mail', Mail, 'koperta poczta'], ['phone', 'Telefon', Phone, 'kontakt'], ['smartphone', 'Smartfon', Smartphone, 'mobile telefon'],
    ['camera', 'Aparat', Camera, 'zdjęcie photo'], ['image', 'Obraz', Image, 'grafika zdjęcie'], ['play', 'Odtwarzaj', Play, 'wideo start'],
    ['music', 'Muzyka', Music, 'nuta audio'], ['video', 'Wideo', Video, 'kamera film'], ['mic', 'Mikrofon', Mic, 'podcast nagranie'],
  ] },
  { category: 'Firma i zaufanie', items: [
    ['user', 'Użytkownik', User, 'osoba profil'], ['users', 'Zespół', Users, 'grupa ludzie'], ['briefcase', 'Firma', BriefcaseBusiness, 'biznes walizka'],
    ['badge-check', 'Zweryfikowany', BadgeCheck, 'badge certyfikat'], ['shield-check', 'Bezpieczeństwo', ShieldCheck, 'ochrona gwarancja tarcza'],
    ['lock', 'Kłódka', Lock, 'ochrona prywatność'], ['key', 'Klucz', KeyRound, 'dostęp'], ['award', 'Nagroda', Award, 'medal jakość'],
    ['crown', 'Korona', Crown, 'premium król'], ['gem', 'Diament', Gem, 'jakość premium'], ['calendar', 'Kalendarz', Calendar, 'data termin'],
    ['clock', 'Zegar', Clock, 'czas godzina'], ['map-pin', 'Lokalizacja', MapPin, 'mapa adres'], ['globe', 'Świat', Globe, 'globus internet'],
    ['link', 'Link', Link, 'łącze'], ['file-text', 'Dokument', FileText, 'plik tekst'], ['folder', 'Folder', Folder, 'katalog pliki'],
  ] },
  { category: 'Natura i kreatywność', items: [
    ['cloud', 'Chmura', Cloud, 'niebo'], ['sun', 'Słońce', Sun, 'pogoda lato'], ['moon', 'Księżyc', Moon, 'noc'], ['leaf', 'Liść', Leaf, 'eko natura'],
    ['flower', 'Kwiat', Flower2, 'roślina'], ['tree', 'Drzewo', TreePine, 'las'], ['mountain', 'Góry', Mountain, 'krajobraz'], ['coffee', 'Kawa', Coffee, 'kubek'],
    ['utensils', 'Jedzenie', Utensils, 'restauracja sztućce'], ['rocket', 'Rakieta', Rocket, 'start rozwój'], ['lightbulb', 'Pomysł', Lightbulb, 'żarówka idea'],
    ['palette', 'Paleta', Palette, 'kolor sztuka'], ['pencil', 'Ołówek', Pencil, 'rysowanie edycja'], ['scissors', 'Nożyczki', Scissors, 'cięcie'],
    ['book', 'Książka', BookOpen, 'czytanie kurs'], ['graduation', 'Edukacja', GraduationCap, 'nauka szkoła kurs'], ['sparkles', 'Iskierki', Sparkles, 'magia ai'],
  ] },
  ...WORK_SVG_GROUPS,
];

export const SVG_ICONS: SvgIconItem[] = groups.flatMap(({ category, items }) => items.map(([id, name, icon, keywords]) => ({ id, name, icon, category, keywords })));
export const normalizeSvgSearch = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
export function filterSvgIcons(search: string, category: string) {
  const words = normalizeSvgSearch(search).split(/\s+/).filter(Boolean);
  return SVG_ICONS.filter(icon => (category === 'all' || icon.category === category)
    && words.every(word => normalizeSvgSearch(`${icon.name} ${icon.keywords} ${icon.id}`).includes(word)));
}
