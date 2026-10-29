export const ADMIN_TABS = [
  'stats',
  'users',
  'sales',
  'purchases',
  'credits',
  'coupons',
  'models',
  'toolpricing',
  'graphics',
  'emojis',
  'badges',
  'content',
  'emails',
  'errors',
  'audit',
  'settings',
  'stripe',
  'mailerlite',
] as const;

export type AdminTabKey = (typeof ADMIN_TABS)[number];

export const ADMIN_TAB_LABELS: Record<AdminTabKey, string> = {
  stats: 'Statystyki',
  users: 'Użytkownicy',
  sales: 'Sprzedaż',
  purchases: 'Zakupy',
  credits: 'Pakiety kredytów',
  coupons: 'Kupony',
  models: 'Modele AI',
  toolpricing: 'Cennik narzędzi',
  graphics: 'Grafiki użytkowników',
  emojis: 'Elementy reklamowe',
  badges: 'Badge',
  content: 'Treści',
  emails: 'E-maile',
  errors: 'Błędy',
  audit: 'Historia działań',
  settings: 'Ustawienia',
  stripe: 'Stripe',
  mailerlite: 'MailerLite',
};

export const ADMIN_TAB_GROUPS: Record<AdminTabKey, string[]> = {
  stats: ['stats'],
  users: ['users'],
  sales: ['sales'],
  purchases: ['purchases', 'sales'],
  credits: ['credits', 'sales'],
  coupons: ['coupons', 'sales'],
  models: ['models', 'ai'],
  toolpricing: ['toolpricing', 'ai'],
  graphics: ['graphics', 'assets'],
  emojis: ['emojis', 'assets'],
  badges: ['badges', 'assets'],
  content: ['content'],
  emails: ['emails'],
  errors: ['errors'],
  audit: ['audit', 'errors', 'settings'],
  settings: ['settings'],
  stripe: ['stripe', 'settings'],
  mailerlite: ['mailerlite', 'settings'],
};

export function resolveAllowedAdminTabs(rawTabs: string[]): AdminTabKey[] {
  return ADMIN_TABS.filter((tab) => ADMIN_TAB_GROUPS[tab].some((candidate) => rawTabs.includes(candidate)));
}
