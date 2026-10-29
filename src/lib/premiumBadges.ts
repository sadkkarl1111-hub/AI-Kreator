import badge9 from '@/assets/badges/premium/webinar-bonus-gift.png';
import badge8 from '@/assets/badges/premium/webinar-signup-coral.png';
import badge7 from '@/assets/badges/premium/return-14-blue.png';
import badge6 from '@/assets/badges/premium/guarantee-90-burgundy.png';
import type { BadgeCatalogItem } from './badgeCatalog';
import badge0 from '@/assets/badges/premium/guarantee-30-emerald.png';
import badge1 from '@/assets/badges/premium/guarantee-60-silver.png';
import badge2 from '@/assets/badges/premium/refund-100-copper.png';
import badge3 from '@/assets/badges/premium/webinar-live-purple.png';
import badge4 from '@/assets/badges/premium/webinar-join-yellow.png';
import badge5 from '@/assets/badges/premium/webinar-recording-blue.png';

export const PREMIUM_BADGES: BadgeCatalogItem[] = [
  { id: 'premium-guarantee-30-emerald', name: "Gwarancja zwrotu 30 dni — szmaragd", description: "Zielono-złota tarcza z gwarancją zwrotu", category: "Gwarancje", addedAt: "2026-10-25T13:00:00Z", src: badge0 },
  { id: 'premium-guarantee-60-silver', name: "Gwarancja zwrotu 60 dni — srebro", description: "Granatowo-srebrna pieczęć z wstążkami", category: "Gwarancje", addedAt: "2026-10-25T13:00:00Z", src: badge1 },
  { id: 'premium-refund-100-copper', name: "100% zwrotu — miedziana pieczęć", description: "Metaliczna pieczęć ze strzałką zwrotu", category: "Gwarancje", addedAt: "2026-10-25T13:00:00Z", src: badge2 },
  { id: 'premium-webinar-live-purple', name: "Webinar na żywo — fioletowy bilet", description: "Fioletowo-złoty bilet na transmisję live", category: "Webinar", addedAt: "2026-10-25T13:00:00Z", src: badge3 },
  { id: 'premium-webinar-join-yellow', name: "Dołącz do webinaru — żółty bilet", description: "Żółty bilet z rezerwacją miejsca i strzałką", category: "Webinar", addedAt: "2026-10-25T13:00:00Z", src: badge4 },
  { id: 'premium-webinar-recording-blue', name: "Nagranie webinaru — niebieski", description: "Niebieska karta nagrania z przyciskiem odtwarzania", category: "Webinar", addedAt: "2026-10-25T13:00:00Z", src: badge5 },
  { id: 'premium-guarantee-90-burgundy', name: "Gwarancja zwrotu 90 dni — bordo", description: "Bordowo-złota pieczęć gwarancji z wstążkami", category: "Gwarancje", addedAt: '2026-10-25T15:00:00Z', src: badge6 },
  { id: 'premium-return-14-blue', name: "14 dni na zwrot zakupu — niebieska tarcza", description: "Srebrno-niebieska tarcza ze znakiem potwierdzenia", category: "Gwarancje", addedAt: '2026-10-25T15:00:00Z', src: badge7 },
  { id: 'premium-webinar-signup-coral', name: "Zapisz się na webinar — koralowy bilet", description: "Koralowy bilet webinarowy z kremowym napisem i strzałką", category: "Webinar", addedAt: '2026-10-25T15:00:00Z', src: badge8 },
  { id: 'premium-webinar-bonus-gift', name: "Bonus dla uczestników — prezent", description: "Fioletowo-złoty prezent z plakietką dla uczestników", category: "Bonusy", addedAt: '2026-10-25T15:00:00Z', src: badge9 }
];
