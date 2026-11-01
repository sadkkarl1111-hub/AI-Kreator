import { WORK_BADGES } from './workBadges';
import { PREMIUM_BADGES } from './premiumBadges';
import { BONUS_BADGES } from './bonusBadges';
import salesBadges from '@/data/sales-badges.json';
import badge5Stars from '@/assets/badges/badge-5stars.webp';
import badgeBestPrice from '@/assets/badges/badge-bestprice.webp';
import badgeBestQuality from '@/assets/badges/badge-bestquality.webp';
import badgeBestseller from '@/assets/badges/badge-bestseller.webp';
import badgeCertified from '@/assets/badges/badge-certified.webp';
import badgeCustomerChoice from '@/assets/badges/badge-customerchoice.webp';
import badgeDailyDeal from '@/assets/badges/badge-dailydeal.webp';
import badgeEco from '@/assets/badges/badge-eco.webp';
import badgeExclusive from '@/assets/badges/badge-exclusive.webp';
import badgeFlashSale from '@/assets/badges/badge-flashsale.webp';
import badgeFree from '@/assets/badges/badge-free.webp';
import badgeFreeShipping from '@/assets/badges/badge-freeshipping.webp';
import badgeGuarantee from '@/assets/badges/badge-guarantee.webp';
import badgeHandmade from '@/assets/badges/badge-handmade.webp';
import badgeHitSezonu from '@/assets/badges/badge-hitsezonu.webp';
import badgeHot from '@/assets/badges/badge-hot.webp';
import badgeLastItems from '@/assets/badges/badge-lastitems.webp';
import badgeLimited from '@/assets/badges/badge-limited.webp';
import badgeLimitedOffer from '@/assets/badges/badge-limitedoffer.webp';
import badgeMegaDeal from '@/assets/badges/badge-megadeal.webp';
import badgeNew from '@/assets/badges/badge-new.webp';
import badgeOriginal from '@/assets/badges/badge-original.webp';
import badgePremium from '@/assets/badges/badge-premium.webp';
import badgeRecommended from '@/assets/badges/badge-recommended.webp';
import badgeReturn30 from '@/assets/badges/badge-return30.webp';
import badgeSale25 from '@/assets/badges/badge-sale25.webp';
import badgeSale50 from '@/assets/badges/badge-sale50.webp';
import badgeSale70 from '@/assets/badges/badge-sale70.webp';
import badgeSuperCena from '@/assets/badges/badge-supercena.webp';
import badgeTopSeller from '@/assets/badges/badge-topseller.webp';
import badgeVerified from '@/assets/badges/badge-verified.webp';
import badgeWyprzedaz from '@/assets/badges/badge-wyprzedaz.webp';
import { WEBINAR_BADGES } from '@/lib/webinarBadges';

export type BadgeCatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  src: string;
  addedAt?: string;
  style?: string;
  color?: string;
};

export const BADGE_CATALOG: BadgeCatalogItem[] = [
  { id: 'free', name: 'Free', description: 'Badge „Za darmo”', category: 'Promocje', src: badgeFree },
  { id: 'sale50', name: '-50% Sale', description: 'Badge rabatowy -50%', category: 'Promocje', src: badgeSale50 },
  { id: 'sale25', name: '-25% Sale', description: 'Badge rabatowy -25%', category: 'Promocje', src: badgeSale25 },
  { id: 'bestprice', name: 'Najlepsza cena', description: 'Badge najlepszej ceny', category: 'Promocje', src: badgeBestPrice },
  { id: 'hot', name: 'Hot', description: 'Badge „Hot” / popularne', category: 'Promocje', src: badgeHot },
  { id: 'limitedoffer', name: 'Limitowana okazja', description: 'Badge limitowanej okazji', category: 'Promocje', src: badgeLimitedOffer },
  { id: 'dailydeal', name: 'Oferta dnia', description: 'Badge oferty dnia', category: 'Promocje', src: badgeDailyDeal },
  { id: 'guarantee', name: 'Gwarancja zwrotu', description: 'Badge gwarancji zwrotu pieniędzy', category: 'Zaufanie', src: badgeGuarantee },
  { id: 'verified', name: 'Sprawdzony sprzedawca', description: 'Badge zweryfikowanego sprzedawcy', category: 'Zaufanie', src: badgeVerified },
  { id: 'recommended', name: 'Polecane', description: 'Badge rekomendacji', category: 'Zaufanie', src: badgeRecommended },
  { id: 'customerchoice', name: 'Wybór klientów', description: 'Badge wyboru klientów', category: 'Zaufanie', src: badgeCustomerChoice },
  { id: 'return30', name: 'Zwrot 30 dni', description: 'Badge zwrotu w 30 dni', category: 'Zaufanie', src: badgeReturn30 },
  { id: 'certified', name: 'Certyfikowany', description: 'Badge certyfikatu jakości', category: 'Zaufanie', src: badgeCertified },
  { id: 'premium', name: 'Premium Quality', description: 'Badge premium jakości', category: 'Jakość', src: badgePremium },
  { id: 'bestseller', name: 'Bestseller', description: 'Badge bestsellera', category: 'Jakość', src: badgeBestseller },
  { id: 'topseller', name: 'Top Sprzedawca', description: 'Badge top sprzedawcy', category: 'Jakość', src: badgeTopSeller },
  { id: 'eco', name: 'Eko', description: 'Badge produktu ekologicznego', category: 'Jakość', src: badgeEco },
  { id: 'handmade', name: 'Handmade', description: 'Badge produktu ręcznie robionego', category: 'Jakość', src: badgeHandmade },
  { id: 'new', name: 'Nowość', description: 'Badge nowego produktu', category: 'Status', src: badgeNew },
  { id: 'limited', name: 'Limitowana edycja', description: 'Badge limitowanej edycji', category: 'Status', src: badgeLimited },
  { id: 'lastitems', name: 'Ostatnie sztuki', description: 'Badge ostatnich sztuk', category: 'Status', src: badgeLastItems },
  { id: 'freeshipping', name: 'Darmowa dostawa', description: 'Badge darmowej dostawy', category: 'Dostawa', src: badgeFreeShipping },
  { id: 'flashsale', name: 'Flash Sale', description: 'Badge błyskawicznej wyprzedaży', category: 'Promocje', src: badgeFlashSale },
  { id: '5stars', name: '5 Gwiazdek', description: 'Badge 5 gwiazdek', category: 'Jakość', src: badge5Stars },
  { id: 'bestquality', name: 'Najlepsza jakość', description: 'Badge najlepszej jakości', category: 'Jakość', src: badgeBestQuality },
  { id: 'megadeal', name: 'Mega Okazja', description: 'Badge mega okazji', category: 'Promocje', src: badgeMegaDeal },
  { id: 'original', name: 'Oryginał', description: 'Badge oryginalnego produktu', category: 'Zaufanie', src: badgeOriginal },
  { id: 'exclusive', name: 'Ekskluzywny', description: 'Badge produktu ekskluzywnego', category: 'Status', src: badgeExclusive },
  { id: 'supercena', name: 'Super Cena', description: 'Badge super ceny', category: 'Promocje', src: badgeSuperCena },
  { id: 'wyprzedaz', name: 'Wyprzedaż', description: 'Badge wyprzedaży', category: 'Promocje', src: badgeWyprzedaz },
  { id: 'hitsezonu', name: 'Hit Sezonu', description: 'Badge hitu sezonu', category: 'Promocje', src: badgeHitSezonu },
  { id: 'sale70', name: '-70% Sale', description: 'Badge rabatowy -70%', category: 'Promocje', src: badgeSale70 },
  ...WEBINAR_BADGES,
  ...PREMIUM_BADGES,
  ...BONUS_BADGES,
  ...WORK_BADGES,
  ...salesBadges,
];
