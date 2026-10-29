import bonusDoKursu from '@/assets/badges/webinar/02-bonus-prezent-fiolet.webp';
import freeNaklejka from '@/assets/badges/webinar/02-free-naklejka-zolta.webp';
import pierwszaMisja from '@/assets/badges/webinar/02-twoja-pierwsza-misja-koperta.webp';
import wejsciowka from '@/assets/badges/webinar/02-wejsciowka-papier-niebieski.webp';
import brunsonPrezent from '@/assets/badges/webinar/03-brunson-prezent.webp';
import gratisPapier from '@/assets/badges/webinar/03-gratis-papier-niebieski.webp';
import zarezerwujMiejsce from '@/assets/badges/webinar/03-zarezerwuj-fiolet-pion.webp';
import bonusPlakietka from '@/assets/badges/webinar/04-bonus-plakietka-fiolet.webp';
import lekcjeWideo from '@/assets/badges/webinar/04-lekcje-wideo-granat-zloto.webp';
import widzimySie from '@/assets/badges/webinar/04-widzimy-sie-zolty.webp';
import dolaczDoWebinaru from '@/assets/badges/webinar/05-dolacz-granat-zloto.webp';
import niebieskiPrezent from '@/assets/badges/webinar/05-niebieski-prezent.webp';
import odPodstaw from '@/assets/badges/webinar/06-od-podstaw-zolty.webp';
import fioletowyPrezent from '@/assets/badges/webinar/07-fioletowy-prezent.webp';
import twojDostep from '@/assets/badges/webinar/08-twoj-dostep-karta-premium.webp';
import granatowyPrezent from '@/assets/badges/webinar/09-granatowy-prezent.webp';
import wybierzSciezke from '@/assets/badges/webinar/12-wybierz-sciezke-drogowskazy.webp';
import odblokujMaterialy from '@/assets/badges/webinar/13-odblokuj-materialy-szuflada.webp';
import maszPytania from '@/assets/badges/webinar/14-masz-pytania-dymki.webp';
import wracajDoNagran from '@/assets/badges/webinar/16-wracaj-kiedy-potrzebujesz-nagrania.webp';
import nastepnyKrok from '@/assets/badges/webinar/18-twoj-nastepny-krok-schody.webp';
import najczestszePytania from '@/assets/badges/webinar/19-najczestsze-pytania-karty-faq.webp';
import wiedzaPraktyka from '@/assets/badges/webinar/21-polacz-wiedze-z-praktyka-puzzle.webp';
import gwarancjaCzerwona from '@/assets/badges/webinar/gwarancja-14-dni-czerwona-pieczec.webp';
import gwarancjaZlota from '@/assets/badges/webinar/gwarancja-14-dni-zlota-tarcza.webp';
import opinieKompakt from '@/assets/badges/webinar/opinie-3467-bez-ramki-kompakt.webp';
import opiniePoziom from '@/assets/badges/webinar/opinie-3467-bez-ramki-poziom.webp';
import opinieKlasyczne from '@/assets/badges/webinar/opinie-pasek-polski-klasyczny.webp';
import opinieZlotaRamka from '@/assets/badges/webinar/opinie-pasek-polski-zlota-ramka.webp';
import prezentDlaUczestnikow from '@/assets/badges/webinar/prezent-dla-uczestnikow-fiolet-3d.webp';
import zwrotCzerwony from '@/assets/badges/webinar/zwrot-100-procent-czerwona-naklejka.webp';
import zwrotZloty from '@/assets/badges/webinar/zwrot-100-procent-zlota-plakietka.webp';

export type WebinarBadge = {
  id: string;
  name: string;
  description: string;
  category: string;
  src: string;
};

export const WEBINAR_BADGES: WebinarBadge[] = [
  { id: 'webinar-bonus-do-kursu', name: 'Bonus do kursu', description: 'Fioletowy prezent z materiałem PDF', category: 'Bonusy', src: bonusDoKursu },
  { id: 'webinar-free-naklejka', name: 'Free', description: 'Żółta naklejka „Free”', category: 'Bonusy', src: freeNaklejka },
  { id: 'webinar-pierwsza-misja', name: 'Twoja pierwsza misja', description: 'Koperta startowa z listą pierwszych kroków', category: 'Kurs i materiały', src: pierwszaMisja },
  { id: 'webinar-wejsciowka', name: 'Twoja wejściówka', description: 'Papierowa wejściówka na webinar', category: 'Webinar', src: wejsciowka },
  { id: 'webinar-bonus-w-prezencie', name: 'Bonus w prezencie', description: 'Żółty prezent z czarną kokardą', category: 'Bonusy', src: brunsonPrezent },
  { id: 'webinar-gratis-papier', name: 'Gratis', description: 'Papierowy badge „Gratis”', category: 'Bonusy', src: gratisPapier },
  { id: 'webinar-zarezerwuj-miejsce', name: 'Zarezerwuj miejsce', description: 'Fioletowy bilet rezerwacyjny na webinar', category: 'Webinar', src: zarezerwujMiejsce },
  { id: 'webinar-bonus-plakietka', name: 'Bonus', description: 'Fioletowa plakietka z kokardą', category: 'Bonusy', src: bonusPlakietka },
  { id: 'webinar-lekcje-wideo', name: 'Lekcje wideo', description: 'Granatowo-złota plakietka lekcji wideo', category: 'Kurs i materiały', src: lekcjeWideo },
  { id: 'webinar-widzimy-sie', name: 'Widzimy się na webinarze', description: 'Żółty bilet webinarowy', category: 'Webinar', src: widzimySie },
  { id: 'webinar-dolacz', name: 'Dołącz do webinaru', description: 'Granatowo-złoty bilet webinarowy', category: 'Webinar', src: dolaczDoWebinaru },
  { id: 'webinar-niebieski-prezent', name: 'Prezent dla Ciebie', description: 'Biały prezent z niebieską kokardą', category: 'Bonusy', src: niebieskiPrezent },
  { id: 'webinar-od-podstaw', name: 'Od podstaw', description: 'Żółty badge ścieżki nauki od podstaw', category: 'Kurs i materiały', src: odPodstaw },
  { id: 'webinar-bonus-dla-ciebie', name: 'Bonus dla Ciebie', description: 'Fioletowy prezent z personalnym podpisem', category: 'Bonusy', src: fioletowyPrezent },
  { id: 'webinar-twoj-dostep', name: 'Twój dostęp', description: 'Karta dostępu do strefy kursanta', category: 'Kurs i materiały', src: twojDostep },
  { id: 'webinar-granatowy-prezent', name: 'Bonus w prezencie', description: 'Granatowy prezent z czerwoną kokardą', category: 'Bonusy', src: granatowyPrezent },
  { id: 'webinar-wybierz-sciezke', name: 'Wybierz swoją ścieżkę', description: 'Drogowskazy ścieżek nauki', category: 'Kurs i materiały', src: wybierzSciezke },
  { id: 'webinar-odblokuj-materialy', name: 'Odblokuj materiały', description: 'Szuflada z lekcjami, szablonami i ćwiczeniami', category: 'Kurs i materiały', src: odblokujMaterialy },
  { id: 'webinar-masz-pytania', name: 'Masz pytania?', description: 'Dymki zachęcające do rozmowy', category: 'Webinar', src: maszPytania },
  { id: 'webinar-wracaj-do-nagran', name: 'Wracaj do nagrań', description: 'Odtwarzacz z dostępem do materiałów', category: 'Kurs i materiały', src: wracajDoNagran },
  { id: 'webinar-nastepny-krok', name: 'Twój następny krok', description: 'Schody pokazujące kolejne etapy', category: 'Kurs i materiały', src: nastepnyKrok },
  { id: 'webinar-faq', name: 'Najczęstsze pytania', description: 'Karty FAQ dla kursu lub webinaru', category: 'Kurs i materiały', src: najczestszePytania },
  { id: 'webinar-wiedza-praktyka', name: 'Połącz wiedzę z praktyką', description: 'Puzzle wiedzy i praktyki', category: 'Kurs i materiały', src: wiedzaPraktyka },
  { id: 'webinar-gwarancja-czerwona', name: 'Gwarancja 14 dni', description: 'Czerwona pieczęć 14-dniowej gwarancji', category: 'Gwarancje', src: gwarancjaCzerwona },
  { id: 'webinar-gwarancja-zlota', name: '14 dni gwarancji', description: 'Granatowo-złota tarcza gwarancji', category: 'Gwarancje', src: gwarancjaZlota },
  { id: 'webinar-opinie-kompakt', name: 'Ocena 4,9/5 — kompakt', description: 'Kompaktowy badge z oceną i liczbą opinii', category: 'Opinie', src: opinieKompakt },
  { id: 'webinar-opinie-poziom', name: 'Ocena 4,9/5 — poziomy', description: 'Poziomy badge z pięcioma gwiazdkami', category: 'Opinie', src: opiniePoziom },
  { id: 'webinar-opinie-klasyczne', name: 'Opinie — klasyczny pasek', description: 'Klasyczny biały pasek z oceną', category: 'Opinie', src: opinieKlasyczne },
  { id: 'webinar-opinie-zlota-ramka', name: 'Opinie — złota ramka', description: 'Pasek opinii ze złotym obramowaniem', category: 'Opinie', src: opinieZlotaRamka },
  { id: 'webinar-prezent-uczestnicy', name: 'Prezent dla uczestników', description: 'Fioletowo-złoty prezent z materiałami', category: 'Bonusy', src: prezentDlaUczestnikow },
  { id: 'webinar-zwrot-czerwony', name: '100% zwrotu', description: 'Czerwona naklejka gwarancji zwrotu', category: 'Gwarancje', src: zwrotCzerwony },
  { id: 'webinar-zwrot-zloty', name: '100% zwrotu — złoty', description: 'Złota plakietka gwarancji zwrotu', category: 'Gwarancje', src: zwrotZloty },
];
