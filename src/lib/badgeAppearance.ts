export const BADGE_LOOKS = [
  { id: '3d', label: '3D i przestrzenne', short: '3D', description: 'Prezenty, pakiety, tarcze i metaliczne pieczęcie' },
  { id: 'drawn', label: 'Ołówkowe i rysowane', short: 'Rysowane', description: 'Szkice ołówkiem, papier i odręczne detale' },
  { id: 'neon', label: 'Neonowe', short: 'Neon', description: 'Świecące napisy, obrysy i neonowe plakietki' },
  { id: 'flat', label: 'Płaskie i wektorowe', short: 'Wektorowe', description: 'Proste kształty, naklejki i czytelne etykiety' },
  { id: 'other', label: 'Pozostałe', short: 'Inne', description: 'Własne grafiki bez określonego stylu' },
] as const;

type AppearanceSource = { id: string; name: string; description: string; style?: string; color?: string; colors?: string[]; look?: string };
const baseIds = new Set(['free','sale50','sale25','bestprice','hot','limitedoffer','dailydeal','guarantee','verified','recommended','customerchoice','return30','certified','premium','bestseller','topseller','eco','handmade','new','limited','lastitems','freeshipping','flashsale','5stars','bestquality','megadeal','original','exclusive','supercena','wyprzedaz','hitsezonu','sale70']);
const paperIds = new Set(['webinar-free-naklejka','webinar-wejsciowka','webinar-gratis-papier','webinar-zarezerwuj-miejsce','webinar-widzimy-sie','webinar-od-podstaw']);
const baseColors: Record<string,string> = { free:'Czerwony',sale50:'Czerwony',sale25:'Czerwony',bestprice:'Złoty',hot:'Czerwony',limitedoffer:'Fioletowy',dailydeal:'Pomarańczowy',guarantee:'Złoty',verified:'Niebieski',recommended:'Zielony',customerchoice:'Złoty',return30:'Zielony',certified:'Złoty',premium:'Złoty',bestseller:'Złoty',topseller:'Złoty',eco:'Zielony',handmade:'Brązowy',new:'Niebieski',limited:'Fioletowy',lastitems:'Czerwony',freeshipping:'Niebieski',flashsale:'Czerwony','5stars':'Złoty',bestquality:'Złoty',megadeal:'Czerwony',original:'Złoty',exclusive:'Czarny',supercena:'Żółty',wyprzedaz:'Czerwony',hitsezonu:'Pomarańczowy',sale70:'Czerwony' };
const hues: [string, RegExp][] = [
  ['Fioletowy', /fiolet|lawend|violet|purple/], ['Złoty', /złot|zlot|gold/], ['Niebieski', /niebies|granat|blue/],
  ['Zielony', /ziel|szmaragd|mint|mięt|miet/], ['Czerwony', /czerw|rubin|bord|red/], ['Różowy', /róż|rozow|pink|koral/],
  ['Żółty', /żół|zol|yellow/], ['Pomarańczowy', /pomara|orange|mied|copper/], ['Turkusowy', /turkus|cyan|turquoise/],
  ['Srebrny', /srebr|silver/], ['Czarny', /czarn|black|grafit/], ['Biały', /bia[łl]|white|krem/], ['Brązowy', /brąz|braz/],
];

// Explicit legacy collections make the original 3D assets discoverable too.
export function badgeAppearance(badge: AppearanceSource) {
  let look = badge.look || 'other', style = badge.style || 'Inny';
  if (!badge.look) {
    if (badge.style === 'Ołówkowy' || paperIds.has(badge.id)) { look = 'drawn'; style = badge.style || 'Papier i rysunek'; }
    else if (badge.style === 'Neon') { look = 'neon'; }
    else if (badge.style === '3D' || badge.id.startsWith('bonus-') || badge.id.startsWith('premium-') || baseIds.has(badge.id)) { look = '3d'; style = badge.style || '3D'; }
    else if (badge.id.startsWith('work-') || badge.id.startsWith('sales-v1-') || badge.id.startsWith('webinar-opinie-')) { look = 'flat'; style = badge.style || 'Plakietki wektorowe'; }
    else if (badge.id.startsWith('webinar-')) { look = '3d'; style = badge.style || '3D'; }
  }
  const colorText = (badge.color || `${badge.name} ${badge.description}`).toLocaleLowerCase('pl');
  const colors = badge.colors?.length ? badge.colors : baseColors[badge.id] ? [baseColors[badge.id]] : hues.filter(([,regex]) => regex.test(colorText)).map(([label]) => label);
  // The work collection uses a fixed palette per category.
  if (!colors.length && badge.id.startsWith('work-')) colors.push('Wielokolorowy');
  return { look, style, color: badge.color || colors.join(' / ') || 'Wielokolorowy', colors: colors.length ? colors : ['Wielokolorowy'] };
}
