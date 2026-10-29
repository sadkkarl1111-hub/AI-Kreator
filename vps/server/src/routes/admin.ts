import { randomUUID } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { deleteBadgeFile, getBadgePublicUrl, saveBadgeFile } from "../lib/badgeFiles.js";
import {
  deleteLocalAiModel,
  deleteLocalEmailTemplate,
  getLocalMailerLiteConfig,
  getLocalSettingsMap,
  listLocalMailerLitePackageGroups,
  listLocalAiModels,
  listLocalEmailTemplates,
  listLocalSiteContent,
  listLocalSiteSettings,
  listLocalToolPricing,
  replaceLocalMailerLitePackageGroupRows,
  syncLocalCoreData,
  upsertLocalMailerLiteConfig,
  upsertLocalAiModelRows,
  upsertLocalEmailTemplateRows,
  upsertLocalSiteContentRows,
  upsertLocalSiteSettingsRows,
  upsertLocalToolPricingRows,
} from "../lib/localCoreData.js";
import {
  clearLocalErrorLogsOlderThan,
  deleteLocalAdminBadge,
  deleteLocalAdminEmoji,
  deleteLocalBadgePackageAccessByBadgeKey,
  deleteLocalEmojiCategory,
  getLocalAdminBadgeById,
  getLocalBadgePackageAccess,
  listLocalAdminBadges,
  listLocalAdminEmojis,
  listLocalBadgePackageAccess,
  listLocalEmojiCategories,
  listLocalErrorLogs,
  listLocalHiddenStaticBadges,
  setLocalBadgePackageAccess,
  setLocalStaticBadgeHidden,
  upsertLocalAdminBadgeRows,
  upsertLocalAdminEmojiRows,
  upsertLocalEmojiCategoryRows,
} from "../lib/localAdminAssetsData.js";
import {
  deleteLocalCreditPackage,
  deleteLocalCreditPurchaseById,
  deleteLocalCreditPurchasesByUserId,
  deleteLocalCreditUsageByUserId,
  getLocalCreditPurchaseById,
  getLocalCreditPackageById,
  getLocalInvoiceSettings,
  getNextLocalCreditPackageSortOrder,
  listLocalCreditPackages,
  listLocalCreditPurchases,
  upsertLocalCreditPackageRows,
  upsertLocalInvoiceSettingsRows,
  updateLocalCreditPurchase,
} from "../lib/localBillingData.js";
import {
  createLocalCoupon,
  createLocalPromoCode,
  deactivateLocalPromoCode,
  deleteLocalCoupon,
  listLocalCoupons,
} from "../lib/localCoupons.js";
import {
  getLocalGraphicsHistoryCount,
  getLocalGraphicsHistoryCountSince,
  hideLocalGraphicById,
  listLocalGraphicsHistoryCreatedSince,
  listLocalGraphicsHistoryStyles,
} from "../lib/localGraphicsData.js";
import {
  deleteLocalCredentialArtifactsByUserId,
  listLocalRefreshTokenActivityByUserIds,
  upsertLocalPasswordCredential,
} from "../lib/localCredentials.js";
import { grantLocalDailyFreeCredits } from "../lib/localDailyCredits.js";
import { sendResetPasswordEmail } from "../lib/passwordResetEmail.js";
import {
  deleteLocalAdminPanelRoleTab,
  deleteLocalAuthUser,
  deleteLocalUserMirror,
  getLocalAuthUser,
  getLocalAuthUsersByUserIds,
  getLocalProfile,
  getLocalProfilesByUserIds,
  getLocalUserCredit,
  hasLocalUserRole,
  listLocalAdminPanelRoles,
  listLocalAdminPanelRoleTabs,
  listLocalAdminPanelUserRoles,
  listLocalAllowedAdminTabs,
  listLocalAuthUsers,
  listLocalUserCredits,
  listLocalUserRoles,
  setLocalAdminPanelUserRole,
  setLocalUserCreditsBalance,
  setLocalUserRole,
  upsertLocalAdminPanelRoleTabsRows,
} from "../lib/localUserData.js";
import { sendInvoiceToKsef } from "../lib/ksef.js";
import { getPaymentProviderLabel, testPaymentConnection } from "../lib/paymentGateway.js";
import { sendAdminSecurityAlertSoon } from "../lib/securityAlerts.js";
import { clearAdminAuditLogsOlderThan, listAdminAuditLogs } from "../lib/adminAuditLog.js";
import { todoRoute } from "../lib/todoRoute.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";

export const adminRouter = Router();

const toDateKey = (value: string | Date | null | undefined) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split("T")[0];
  }

  const normalized = String(value);
  if (!normalized) return null;

  if (normalized.includes("T")) {
    return normalized.split("T")[0];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
};

const latestTimestamp = (...values: Array<string | null | undefined>) => {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latestValue = value;
    latestTime = time;
  }

  return latestValue;
};

const ADMIN_TABS = [
  "stats",
  "users",
  "sales",
  "ai",
  "assets",
  "content",
  "emails",
  "errors",
  "audit",
  "settings",
  "purchases",
  "credits",
  "coupons",
  "graphics",
  "models",
  "toolpricing",
  "stripe",
  "mailerlite",
  "emojis",
  "badges",
];

const ACTION_TABS: Record<string, string[]> = {
  list_users: ["users", "stats", "purchases", "graphics"],
  list_user_graphics: ["graphics"],
  send_reset: ["users"],
  update_password: ["users"],
  add_credits: ["users"],
  remove_credits: ["users"],
  delete_user: ["users"],
  toggle_admin: ["users"],
  list_role_access: ["users"],
  set_panel_role: ["users"],
  toggle_role_tab: ["users"],
};

type AdminActionBody = {
  action?: string;
  userId?: string;
  credits?: number;
  password?: string;
  roleKey?: string | null;
  tabKey?: string;
  enabled?: boolean;
};

type AdminCouponActionBody = {
  action?: string;
  couponId?: string;
  name?: string;
  percentOff?: number;
  amountOff?: number;
  code?: string;
  promoId?: string;
};

type AdminStripeActionBody = {
  action?: string;
};

type AdminMailerLiteActionBody = {
  action?: string;
  apiKey?: string;
  email?: string | null;
  groupId?: string;
  includeGroups?: boolean;
  mappings?: PackageGroupMapping[];
};

type AdminEmailTemplateActionBody = {
  action?: string;
  templateId?: string;
  template?: Partial<EmailTemplate>;
};

type AdminEmojiActionBody = {
  action?: string;
  categoryId?: string;
  emojiId?: string;
  label?: string;
  labels?: string[];
  emojis?: string[];
};

type AdminPackageActionBody = {
  action?: string;
  packageId?: string;
  package?: Partial<CreditPackage>;
};

type AdminToolPricingActionBody = {
  action?: string;
  toolId?: string;
  updates?: Partial<ToolPrice>;
};

type AdminStatsActionBody = {
  action?: string;
  todayStart?: string;
  monthStart?: string;
  fourteenDaysAgo?: string;
};

type AdminSettingsActionBody = {
  action?: string;
  entries?: Array<[string, string]>;
  force?: boolean;
};

type AdminContentActionBody = {
  action?: string;
  slug?: string;
  title?: string;
  content?: string;
};

type AdminModelActionBody = {
  action?: string;
  modelId?: string;
  model?: Partial<AdminAiModel>;
};

type AdminErrorLogActionBody = {
  action?: string;
  source?: string;
  userId?: string;
  retentionDays?: number;
};

type AdminAuditLogActionBody = {
  action?: string;
  search?: string;
  severity?: string;
  limit?: number;
  retentionDays?: number;
};

type AdminPublicGalleryActionBody = {
  action?: string;
  graphicId?: string;
};

type AdminPurchaseActionBody = {
  action?: string;
  purchaseId?: string;
  purchase?: Partial<CreditPurchase>;
  invoiceSettings?: Partial<InvoiceSettings>;
  environment?: string;
};

type AdminBadgeActionBody = {
  action?: string;
  badgeId?: string;
  badgeKey?: string;
  packageId?: string;
  badge?: {
    name?: string;
    description?: string;
    category?: string;
    fileName?: string;
    fileType?: string;
    fileBase64?: string;
  };
};

type StripeBalanceItem = {
  amount: number;
  currency: string;
};

type StripeBalance = {
  available: StripeBalanceItem[];
  pending: StripeBalanceItem[];
};

type StripeCoupon = {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  valid: boolean;
  times_redeemed: number;
  created: number;
};

type StripePromotionCode = {
  id: string;
  code: string;
  active: boolean;
  times_redeemed: number;
  max_redemptions: number | null;
};

type StripeCustomer = {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
};

type StripeAccount = {
  id: string;
};

type CreditPurchase = {
  id: string;
  user_id: string;
  amount: number;
  paid_amount: number | null;
  credits: number;
  status: string;
  stripe_session_id: string | null;
  payu_order_id?: string | null;
  created_at: string;
  billing_type?: string | null;
  billing_name?: string | null;
  billing_nip?: string | null;
  billing_company?: string | null;
  billing_address?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  ksef_reference_number?: string | null;
  ksef_invoice_number?: string | null;
  ksef_session_reference_number?: string | null;
  ksef_environment?: string | null;
  ksef_sent_at?: string | null;
  ksef_error?: string | null;
};

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
};

type InvoiceSettings = {
  id: string;
  company_name: string;
  nip: string;
  address: string;
  postal_code: string;
  city: string;
  email: string;
};

type MailerLiteGroup = {
  id: string;
  name: string;
  active_count?: number;
};

type CreditPackage = {
  id: string;
  label: string;
  active?: boolean;
  credits?: number;
  price_grosze?: number;
  popular?: boolean;
  sort_order?: number;
};

type ToolPrice = {
  id: string;
  tool_id: string;
  label: string;
  credit_cost: number;
  active: boolean;
  access_tier: string;
  visible: boolean;
  popular: boolean;
};

type AdminAiModel = {
  id: string;
  name: string;
  model_id: string;
  provider: string;
  api_model: string | null;
  credit_cost: number;
  active: boolean;
  sort_order: number;
  supports_generation: boolean;
  supports_editing: boolean;
  supports_reference_images: boolean;
};

type EmailTemplate = {
  id: string;
  slug: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
  active: boolean;
  updated_at: string;
};

type EmojiCategory = {
  id: string;
  label: string;
  sort_order: number;
};

type AdminEmoji = {
  id: string;
  category_id: string;
  emoji: string;
  sort_order: number;
};

type AdminBadge = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  storage_path: string;
  sort_order: number;
};

type HiddenStaticBadge = {
  badge_key: string;
};

type BadgePackageAccess = {
  id: string;
  badge_key: string;
  package_id: string;
};

type PackageGroupMapping = {
  package_id: string;
  group_id: string;
  group_name: string;
};

type StripeList<T> = {
  data: T[];
};

const MAILERLITE_API_BASE = "https://connect.mailerlite.com/api";

/*
const stripeRequest = async <T>(_path: string, _options: { method?: string; body?: URLSearchParams } = {}) => {
  throw new Error("Stripe API is disabled. Use PayU integration.");
  const data = null as (T & { error?: { message?: string } }) | null;

  if (!stripeResponse.ok) {
    throw new Error(data?.error?.message || `Stripe zwrócił błąd ${stripeResponse.status}.`);
  }

  return data as T;
};

const withPromotionCodes = async (coupon: StripeCoupon) => {
  const promoCodes = await stripeRequest<StripeList<StripePromotionCode>>(
    `/promotion_codes?coupon=${encodeURIComponent(coupon.id)}&limit=10`
  );

  return {
    id: coupon.id,
    name: coupon.name,
    percent_off: coupon.percent_off,
    amount_off: coupon.amount_off,
    currency: coupon.currency,
    duration: coupon.duration,
    valid: coupon.valid,
    times_redeemed: coupon.times_redeemed,
    created: coupon.created,
    promotion_codes: promoCodes.data.map((promotionCode) => ({
      id: promotionCode.id,
      code: promotionCode.code,
      active: promotionCode.active,
      times_redeemed: promotionCode.times_redeemed,
      max_redemptions: promotionCode.max_redemptions,
    })),
  };
};
*/

const toStripeParams = (values: Record<string, string | number | boolean | null | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params;
};

const stripeRequest = async <T>(_path: string, _options: { method?: string; body?: URLSearchParams } = {}) => {
  throw new Error("Integracja Stripe jest wylaczona. Uzyj PayU.");
  return {} as T;
};

const withPromotionCodes = async (coupon: StripeCoupon) => {
  return {
    ...coupon,
    promotion_codes: [],
  };
};

const getMailerLiteKey = async (providedKey?: string) => {
  const trimmedKey = providedKey?.trim();
  if (trimmedKey) return trimmedKey;

  const config = await getLocalMailerLiteConfig();
  if (!config?.api_key) {
    throw new Error("Brak klucza API MailerLite. Zapisz klucz w ustawieniach integracji.");
  }

  return config.api_key;
};

const mailerLiteRequest = async <T>(
  apiKey: string,
  path: string,
  options: { method?: string; body?: unknown } = {}
) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const mailerLiteResponse = await fetch(`${MAILERLITE_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await mailerLiteResponse.json().catch(() => null) as
    | ({ message?: string; error?: string | { message?: string } } & T)
    | null;

  if (!mailerLiteResponse.ok) {
    const nestedMessage = typeof data?.error === "object" ? data.error.message : data?.error;
    throw new Error(data?.message || nestedMessage || `MailerLite zwrocil blad ${mailerLiteResponse.status}.`);
  }

  return data as T;
};

const fetchMailerLiteGroups = async (apiKey: string) => {
  const result = await mailerLiteRequest<{ data?: MailerLiteGroup[] }>(
    apiKey,
    "/groups?limit=100&sort=name"
  );

  return result.data || [];
};

const getIsSuperAdmin = async (userId: string) => {
  return hasLocalUserRole(userId, "admin");
};

const hasAnyTabAccess = async (userId: string, tabs: string[], isSuperAdmin: boolean) => {
  if (isSuperAdmin) return true;
  const allowedTabs = await listLocalAllowedAdminTabs(userId);
  return tabs.some((tab) => allowedTabs.includes(tab));
};

const normalizeBase64Payload = (value?: string) => {
  if (!value) return null;
  const [, dataUrlPayload] = value.split(",");
  return dataUrlPayload || value;
};

adminRouter.post("/admin/users/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const body = request.body as AdminActionBody;
    const { action, userId, credits, password, roleKey, tabKey, enabled } = body;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const requiredTabs = ACTION_TABS[action];
    if (!requiredTabs) {
      response.status(400).json({ ok: false, error: "Unknown action" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, requiredTabs, isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnień do tej zakładki" });
      return;
    }

    if (["toggle_admin", "set_panel_role", "toggle_role_tab"].includes(action) && !isSuperAdmin) {
      response.status(403).json({ ok: false, error: "Ta operacja wymaga roli admin" });
      return;
    }

    if (action === "list_users") {
      const [authUsers, allCredits, allRoles, allPanelRoles] = await Promise.all([
        listLocalAuthUsers(),
        listLocalUserCredits(),
        listLocalUserRoles(),
        listLocalAdminPanelUserRoles(),
      ]);
      const refreshActivity = await listLocalRefreshTokenActivityByUserIds(
        authUsers.map((user) => user.user_id)
      );
      const refreshActivityByUserId = new Map(
        refreshActivity.map((activity) => [activity.userId, activity.lastActivityAt])
      );

      const users = authUsers.map((user) => ({
        id: user.user_id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: latestTimestamp(
          user.last_sign_in_at,
          refreshActivityByUserId.get(user.user_id)
        ),
        credits: allCredits.find((credit) => credit.user_id === user.user_id)?.balance ?? 0,
        roles: allRoles.filter((role) => role.user_id === user.user_id).map((role) => role.role),
        panel_role: allPanelRoles.find((role) => role.user_id === user.user_id)?.role_key ?? null,
      }));

      response.json({ ok: true, users });
      return;
    }

    if (action === "list_role_access") {
      const [roles, roleTabs] = await Promise.all([listLocalAdminPanelRoles(), listLocalAdminPanelRoleTabs()]);

      response.json({
        ok: true,
        roles: (roles || []).map((role) => ({
          ...role,
          tabs: (roleTabs || []).filter((roleTab) => roleTab.role_key === role.role_key).map((roleTab) => roleTab.tab_key),
        })),
      });
      return;
    }

    if (action === "set_panel_role") {
      if (!userId) {
        response.status(400).json({ ok: false, error: "userId is required" });
        return;
      }

      if (!roleKey) {
        await setLocalAdminPanelUserRole(userId, null);
        const [actorUser, targetUser] = await Promise.all([
          getLocalAuthUser(requestingUserId).catch(() => null),
          getLocalAuthUser(userId).catch(() => null),
        ]);
        sendAdminSecurityAlertSoon({
          eventKey: `admin-panel-role-cleared:${userId}:${Date.now()}`,
          title: "Usunięto rolę panelu użytkownika",
          severity: "warning",
          actorEmail: actorUser?.email,
          actorUserId: requestingUserId,
          targetEmail: targetUser?.email,
          targetUserId: userId,
          request,
        });
        response.json({ ok: true, success: true, message: "Rola panelu usunięta" });
        return;
      }

      const roleExists = (await listLocalAdminPanelRoles()).find((role) => role.role_key === roleKey);

      if (!roleExists) {
        response.status(400).json({ ok: false, error: "Nieprawidłowa rola" });
        return;
      }

      await setLocalAdminPanelUserRole(userId, roleKey);
      const [actorUser, targetUser] = await Promise.all([
        getLocalAuthUser(requestingUserId).catch(() => null),
        getLocalAuthUser(userId).catch(() => null),
      ]);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-panel-role-set:${userId}:${roleKey}:${Date.now()}`,
        title: "Zmieniono rolę panelu użytkownika",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        targetEmail: targetUser?.email,
        targetUserId: userId,
        request,
        details: {
          rola: roleKey,
        },
      });

      response.json({ ok: true, success: true, message: "Rola panelu zapisana" });
      return;
    }

    if (action === "toggle_role_tab") {
      if (!roleKey || !tabKey) {
        response.status(400).json({ ok: false, error: "roleKey i tabKey są wymagane" });
        return;
      }

      if (!ADMIN_TABS.includes(tabKey)) {
        response.status(400).json({ ok: false, error: "Nieprawidłowa zakładka" });
        return;
      }

      if (enabled) {
        await upsertLocalAdminPanelRoleTabsRows([{ role_key: roleKey, tab_key: tabKey }]);
      } else {
        await deleteLocalAdminPanelRoleTab(roleKey, tabKey);
      }

      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-role-tab:${roleKey}:${tabKey}:${enabled ? "on" : "off"}:${Date.now()}`,
        title: "Zmieniono dostęp roli panelu",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          rola: roleKey,
          zakladka: tabKey,
          dostep: enabled ? "włączony" : "wyłączony",
        },
      });

      response.json({ ok: true, success: true, message: "Dostęp roli zaktualizowany" });
      return;
    }

    if (!userId) {
      response.status(400).json({ ok: false, error: "userId is required" });
      return;
    }

    if (action === "send_reset") {
      const email = (await getLocalAuthUser(userId))?.email;

      if (!email) {
        response.status(404).json({ ok: false, error: "Nie znaleziono użytkownika" });
        return;
      }

      await sendResetPasswordEmail(email);
      response.json({ ok: true, success: true, message: "Link resetowania wysłany na email" });
      return;
    }

    if (action === "update_password") {
      if (!password || password.length < 6) {
        response.status(400).json({ ok: false, error: "Hasło musi mieć minimum 6 znaków" });
        return;
      }

      const localAuthUser = await getLocalAuthUser(userId);
      if (!localAuthUser) {
        response.status(404).json({ ok: false, error: "Nie znaleziono uzytkownika" });
        return;
      }

      await upsertLocalPasswordCredential({
        userId,
        email: localAuthUser.email,
        password,
        migratedFrom: "admin-update-password",
      });
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-password-changed:${userId}:${Date.now()}`,
        title: "Administrator zmienił hasło użytkownika",
        severity: "critical",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        targetEmail: localAuthUser.email,
        targetUserId: userId,
        request,
      });

      response.json({ ok: true, success: true, message: "Hasło zmienione" });
      return;
    }

    if (action === "toggle_admin") {
      if (userId === requestingUserId) {
        response.status(400).json({ ok: false, error: "Nie możesz usunąć sobie roli admina" });
        return;
      }

      const existingRole = await hasLocalUserRole(userId, "admin");

      if (existingRole) {
        await setLocalUserRole(userId, "admin", false);
        const [actorUser, targetUser] = await Promise.all([
          getLocalAuthUser(requestingUserId).catch(() => null),
          getLocalAuthUser(userId).catch(() => null),
        ]);
        sendAdminSecurityAlertSoon({
          eventKey: `admin-role-removed:${userId}:${Date.now()}`,
          title: "Usunięto rolę administratora",
          severity: "critical",
          actorEmail: actorUser?.email,
          actorUserId: requestingUserId,
          targetEmail: targetUser?.email,
          targetUserId: userId,
          request,
        });
        response.json({ ok: true, success: true, message: "Rola admina usunięta" });
        return;
      }

      await setLocalUserRole(userId, "admin", true);
      const [actorUser, targetUser] = await Promise.all([
        getLocalAuthUser(requestingUserId).catch(() => null),
        getLocalAuthUser(userId).catch(() => null),
      ]);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-role-granted:${userId}:${Date.now()}`,
        title: "Nadano rolę administratora",
        severity: "critical",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        targetEmail: targetUser?.email,
        targetUserId: userId,
        request,
      });
      response.json({ ok: true, success: true, message: "Rola admina nadana" });
      return;
    }

    if (action === "add_credits" || action === "remove_credits") {
      const amount = Number(credits);
      if (!amount || amount <= 0 || amount > 100000) {
        response.status(400).json({ ok: false, error: "Podaj prawidłową liczbę kredytów (1-100000)" });
        return;
      }

      const currentCredits = await getLocalUserCredit(userId);

      if (action === "remove_credits") {
        const currentBalance = currentCredits?.balance ?? 0;
        const newBalance = Math.max(0, currentBalance - amount);
        const actualRemoved = currentBalance - newBalance;

        await setLocalUserCreditsBalance(userId, newBalance);
        const [actorUser, targetUser] = await Promise.all([
          getLocalAuthUser(requestingUserId).catch(() => null),
          getLocalAuthUser(userId).catch(() => null),
        ]);
        sendAdminSecurityAlertSoon({
          eventKey: `admin-credits-remove:${userId}:${Date.now()}`,
          title: "Administrator odjął kredyty użytkownikowi",
          severity: "warning",
          actorEmail: actorUser?.email,
          actorUserId: requestingUserId,
          targetEmail: targetUser?.email,
          targetUserId: userId,
          request,
          details: {
            kwota: actualRemoved,
            noweSaldo: newBalance,
          },
        });


        response.json({ ok: true, success: true, message: `Zabrano ${actualRemoved} kredytów. Nowe saldo: ${newBalance}` });
        return;
      }

      const newBalance = (currentCredits?.balance ?? 0) + amount;
      await setLocalUserCreditsBalance(userId, newBalance);
      const [actorUser, targetUser] = await Promise.all([
        getLocalAuthUser(requestingUserId).catch(() => null),
        getLocalAuthUser(userId).catch(() => null),
      ]);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-credits-add:${userId}:${Date.now()}`,
        title: "Administrator dodał kredyty użytkownikowi",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        targetEmail: targetUser?.email,
        targetUserId: userId,
        request,
        details: {
          kwota: amount,
          noweSaldo: newBalance,
        },
      });


      response.json({ ok: true, success: true, message: `Dodano ${amount} kredytów` });
      return;
    }

    if (action === "delete_user") {
      if (userId === requestingUserId) {
        response.status(400).json({ ok: false, error: "Nie możesz usunąć własnego konta" });
        return;
      }

      await Promise.all([
        deleteLocalUserMirror(userId),
        deleteLocalAuthUser(userId),
        deleteLocalCredentialArtifactsByUserId(userId),
        deleteLocalCreditUsageByUserId(userId),
        deleteLocalCreditPurchasesByUserId(userId),
      ]);

      response.json({ ok: true, success: true, message: "Użytkownik usunięty" });
      return;
    }

    response.status(400).json({ ok: false, error: "Unknown action" });
  } catch (error) {
    console.error("VPS admin users action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystąpił błąd serwera."
    });
  }
});

adminRouter.post("/admin/coupons/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, couponId, name, percentOff, amountOff, code, promoId } = request.body as AdminCouponActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["coupons", "sales"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak dostępu do zakładki Kody" });
      return;
    }

    if (action === "list") {
      const coupons = (await listLocalCoupons()) as StripeCoupon[];
      response.json({ ok: true, coupons });
      return;
    }

    if (action === "create_coupon") {
      const coupon = (await createLocalCoupon({
        name,
        percentOff: Number(percentOff),
        amountOff: Number(amountOff),
      })) as StripeCoupon;
      response.json({ ok: true, coupon });
      return;
    }

    if (action === "create_promo_code") {
      if (!couponId || !code?.trim()) {
        response.status(400).json({ ok: false, error: "Podaj kupon i kod" });
        return;
      }

      const promo = (await createLocalPromoCode({
        couponId,
        code: code.trim().toUpperCase(),
      })) as StripePromotionCode;
      response.json({ ok: true, promo });
      return;
    }

    if (action === "deactivate_promo") {
      if (!promoId) {
        response.status(400).json({ ok: false, error: "Podaj ID kodu" });
        return;
      }
      await deactivateLocalPromoCode(promoId);
      response.json({ ok: true, success: true });
      return;
    }

    if (action === "delete_coupon") {
      if (!couponId) {
        response.status(400).json({ ok: false, error: "Podaj ID kuponu" });
        return;
      }
      await deleteLocalCoupon(couponId);
      response.json({ ok: true, success: true });
      return;
    }

    if (false && action === "create_coupon") {
      const percentValue = Number(percentOff);
      const amountValue = Number(amountOff);
      const params: Record<string, string | number | boolean | null | undefined> = {
        name: name || "Kupon rabatowy",
        duration: "once",
      };

      if (Number.isFinite(percentValue) && percentValue > 0) {
        if (percentValue > 100) {
          response.status(400).json({ ok: false, error: "Procent musi być między 1 a 100" });
          return;
        }
        params.percent_off = percentValue;
      } else if (Number.isFinite(amountValue) && amountValue > 0) {
        params.amount_off = amountValue;
        params.currency = "pln";
      } else {
        response.status(400).json({ ok: false, error: "Podaj procent lub kwotę rabatu" });
        return;
      }

      const coupon = await stripeRequest<StripeCoupon>("/coupons", {
        method: "POST",
        body: toStripeParams(params),
      });

      response.json({ ok: true, coupon });
      return;
    }

    if (action === "create_promo_code") {
      if (!couponId || !code?.trim()) {
        response.status(400).json({ ok: false, error: "Podaj kupon i kod" });
        return;
      }

      const promo = await stripeRequest<StripePromotionCode>("/promotion_codes", {
        method: "POST",
        body: toStripeParams({
          coupon: couponId,
          code: code.trim().toUpperCase(),
          active: true,
        }),
      });

      response.json({ ok: true, promo });
      return;
    }

    if (action === "deactivate_promo") {
      if (!promoId) {
        response.status(400).json({ ok: false, error: "Podaj ID kodu" });
        return;
      }

      await stripeRequest<StripePromotionCode>(`/promotion_codes/${encodeURIComponent(promoId)}`, {
        method: "POST",
        body: toStripeParams({ active: false }),
      });

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "delete_coupon") {
      if (!couponId) {
        response.status(400).json({ ok: false, error: "Podaj ID kuponu" });
        return;
      }

      await stripeRequest<{ id: string; deleted: boolean }>(`/coupons/${encodeURIComponent(couponId)}`, {
        method: "DELETE",
      });

      response.json({ ok: true, success: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin coupons action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystąpił błąd serwera.",
    });
  }
});

const handleAdminPaymentsAction = async (request: any, response: any) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action } = request.body as AdminStripeActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["stripe", "sales"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak dostępu do zakładki Stripe" });
      return;
    }

    if (action === "test_connection") {
      const connection = await testPaymentConnection();
      response.json({
        ok: true,
        accountId: `${connection.providerLabel} ${connection.accountId}`,
        provider: connection.provider,
        providerLabel: connection.providerLabel,
      });
      return;
    }

    if (action === "dashboard") {
      const appPurchases = await listLocalCreditPurchases({ limit: 30 });
      const userIds = [...new Set(appPurchases.map((purchase) => purchase.user_id).filter(Boolean))];
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        profiles = (await getLocalProfilesByUserIds(userIds)) as Profile[];
      }

      const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
      const payments = appPurchases.map((purchase) => ({
        id: purchase.id,
        amount: purchase.amount,
        paidAmount: purchase.paid_amount,
        currency: "pln",
        status: purchase.status === "completed" ? "succeeded" : purchase.status === "pending" ? "processing" : purchase.status,
        created: Math.floor(new Date(purchase.created_at || new Date().toISOString()).getTime() / 1000),
        customerEmail: profileMap.get(purchase.user_id)?.email || null,
        description: `${purchase.credits} kredytow`,
      }));

      const customers = profiles
        .filter((profile) => profile.email)
        .slice(0, 10)
        .map((profile) => ({
          id: profile.user_id,
          email: profile.email,
          name: profile.display_name,
          created: Math.floor(Date.now() / 1000),
        })) as StripeCustomer[];

      response.json({
        ok: true,
        providerLabel: `${getPaymentProviderLabel()} dashboard`,
        availableBalance: [] as StripeBalanceItem[],
        pendingBalance: [] as StripeBalanceItem[],
        payments,
        customers,
      });
      return;
    }

    if (false && action === "test_connection") {
      const account = await stripeRequest<StripeAccount>("/account");
      response.json({ ok: true, accountId: account.id });
      return;
    }

    if (false && action === "dashboard") {
      const [balance, recentCustomers, appPurchases] = await Promise.all([
        stripeRequest<StripeBalance>("/balance"),
        stripeRequest<StripeList<StripeCustomer>>("/customers?limit=10"),
        listLocalCreditPurchases({ limit: 30 }),
      ]);
      const userIds = [...new Set(appPurchases.map((purchase) => purchase.user_id).filter(Boolean))];
      let profiles: Profile[] = [];

      if (userIds.length > 0) {
        profiles = (await getLocalProfilesByUserIds(userIds)) as Profile[];
      }

      const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
      const payments = appPurchases.map((purchase) => ({
        id: purchase.id,
        amount: purchase.amount,
        paidAmount: purchase.paid_amount,
        currency: "pln",
        status: purchase.status === "completed" ? "succeeded" : purchase.status === "pending" ? "processing" : purchase.status,
        created: Math.floor(new Date(purchase.created_at || new Date().toISOString()).getTime() / 1000),
        customerEmail: profileMap.get(purchase.user_id)?.email || null,
        description: `${purchase.credits} kredytów`,
      }));

      const appCustomerEmails = new Set(
        profiles
          .map((profile) => profile.email?.toLowerCase())
          .filter((email): email is string => Boolean(email))
      );

      const customers = recentCustomers.data
        .filter((customer) => customer.email && appCustomerEmails.has(customer.email.toLowerCase()))
        .map((customer) => ({
          id: customer.id,
          email: customer.email,
          name: customer.name,
          created: customer.created,
        }));

      response.json({
        ok: true,
        availableBalance: balance.available.map((item) => ({
          amount: item.amount,
          currency: item.currency,
        })),
        pendingBalance: balance.pending.map((item) => ({
          amount: item.amount,
          currency: item.currency,
        })),
        payments,
        customers,
      });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin payments action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystąpił błąd serwera.",
    });
  }
};

adminRouter.post("/admin/payments/actions", requireAuthenticatedUser, handleAdminPaymentsAction);
adminRouter.post("/admin/stripe/actions", requireAuthenticatedUser, handleAdminPaymentsAction);

adminRouter.post("/admin/mailerlite/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, apiKey, email, groupId, includeGroups = true, mappings = [] } =
      request.body as AdminMailerLiteActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    const requiredTabs = action === "add_subscriber" ? ["mailerlite", "purchases", "sales"] : ["mailerlite"];
    if (!(await hasAnyTabAccess(requestingUserId, requiredTabs, isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak dostepu do zakladki MailerLite" });
      return;
    }

    if (action === "load_config") {
      const [packages, mappings, config] = await Promise.all([
        listLocalCreditPackages(),
        listLocalMailerLitePackageGroups(),
        getLocalMailerLiteConfig(),
      ]);
      let groups: MailerLiteGroup[] = [];
      let connected = false;
      let connectionError: string | null = null;

      if (includeGroups && config?.api_key) {
        try {
          groups = await fetchMailerLiteGroups(config.api_key);
          connected = true;
        } catch (error) {
          connectionError = error instanceof Error ? error.message : "Nie udalo sie pobrac grup MailerLite.";
        }
      }

      response.json({
        ok: true,
        packages: packages as CreditPackage[],
        mappings: mappings as PackageGroupMapping[],
        groups,
        connected,
        savedApiKey: config?.api_key ? "configured" : "",
        connectionError,
      });
      return;
    }

    if (action === "fetch_groups") {
      const key = await getMailerLiteKey(apiKey);
      const groups = await fetchMailerLiteGroups(key);
      response.json({ ok: true, groups, connected: true });
      return;
    }

    if (action === "save_config") {
      const key = apiKey?.trim();
      if (!key) {
        response.status(400).json({ ok: false, error: "Wpisz klucz API MailerLite" });
        return;
      }

      const groups = await fetchMailerLiteGroups(key);
      await upsertLocalMailerLiteConfig(key);

      response.json({ ok: true, groups, connected: true, savedApiKey: "configured" });
      return;
    }

    if (action === "save_mappings") {
      if (!Array.isArray(mappings)) {
        response.status(400).json({ ok: false, error: "Nieprawidlowe przypisania grup" });
        return;
      }

      const cleanMappings = mappings
        .filter((mapping) => mapping.package_id && mapping.group_id)
        .map((mapping) => ({
          package_id: mapping.package_id,
          group_id: mapping.group_id,
          group_name: mapping.group_name || "",
        }));

      const savedMappings = await replaceLocalMailerLitePackageGroupRows(cleanMappings);

      response.json({ ok: true, success: true, mappings: savedMappings });
      return;
    }

    if (action === "add_subscriber") {
      if (!email || !groupId) {
        response.status(400).json({ ok: false, error: "Email i grupa MailerLite sa wymagane" });
        return;
      }

      const key = await getMailerLiteKey();
      await mailerLiteRequest(key, "/subscribers", {
        method: "POST",
        body: {
          email,
          groups: [groupId],
        },
      });

      response.json({ ok: true, success: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin MailerLite action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/email-templates/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, templateId, template } = request.body as AdminEmailTemplateActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["emails", "content"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do szablonow e-mail" });
      return;
    }

    if (action === "list") {
      response.json({ ok: true, templates: await listLocalEmailTemplates() });
      return;
    }

    if (action === "create") {
      if (!template?.slug || !template?.name || !template?.subject || !template?.html_content) {
        response.status(400).json({ ok: false, error: "Slug, nazwa, temat i tresc HTML sa wymagane" });
        return;
      }

      const existingBySlug = (await listLocalEmailTemplates()).find((row) => row.slug === template.slug);
      if (existingBySlug) {
        response.status(400).json({ ok: false, error: "Szablon o tym slug juz istnieje" });
        return;
      }

      const [savedTemplate] = await upsertLocalEmailTemplateRows([
        {
          id: randomUUID(),
          slug: template.slug,
          name: template.name,
          subject: template.subject,
          html_content: template.html_content,
          variables: template.variables || [],
          active: template.active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      response.json({ ok: true, template: savedTemplate || null });
      return;
    }

    if (action === "update") {
      if (!templateId) {
        response.status(400).json({ ok: false, error: "Brak ID szablonu" });
        return;
      }

      const updatePayload: Partial<EmailTemplate> = {};
      if (template?.name !== undefined) updatePayload.name = template.name;
      if (template?.subject !== undefined) updatePayload.subject = template.subject;
      if (template?.html_content !== undefined) updatePayload.html_content = template.html_content;
      if (template?.variables !== undefined) updatePayload.variables = template.variables;
      if (template?.active !== undefined) updatePayload.active = template.active;

      const existingTemplate = (await listLocalEmailTemplates()).find((row) => row.id === templateId);
      if (!existingTemplate) {
        response.status(404).json({ ok: false, error: "Nie znaleziono szablonu" });
        return;
      }

      const [savedTemplate] = await upsertLocalEmailTemplateRows([
        {
          ...existingTemplate,
          ...updatePayload,
          id: existingTemplate.id,
          slug: existingTemplate.slug,
          updated_at: new Date().toISOString(),
        },
      ]);

      response.json({ ok: true, template: savedTemplate || existingTemplate });
      return;
    }

    if (action === "delete") {
      if (!templateId) {
        response.status(400).json({ ok: false, error: "Brak ID szablonu" });
        return;
      }

      await deleteLocalEmailTemplate(templateId);

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "toggle") {
      if (!templateId || template?.active === undefined) {
        response.status(400).json({ ok: false, error: "Brak ID lub statusu szablonu" });
        return;
      }

      const existingTemplate = (await listLocalEmailTemplates()).find((row) => row.id === templateId);
      if (!existingTemplate) {
        response.status(404).json({ ok: false, error: "Nie znaleziono szablonu" });
        return;
      }

      const [savedTemplate] = await upsertLocalEmailTemplateRows([
        {
          ...existingTemplate,
          active: template.active,
          updated_at: new Date().toISOString(),
        },
      ]);

      response.json({ ok: true, template: savedTemplate || existingTemplate });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin email templates action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/emojis/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, categoryId, emojiId, label, labels, emojis } = request.body as AdminEmojiActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["emojis", "assets", "content"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do emoji" });
      return;
    }

    if (action === "list") {
      const [cats, emojiRows] = await Promise.all([
        listLocalEmojiCategories(),
        listLocalAdminEmojis(),
      ]);
      const categories = (cats as EmojiCategory[]).map((category) => ({
        ...category,
        emojis: (emojiRows as AdminEmoji[]).filter((emoji) => emoji.category_id === category.id),
      }));

      response.json({ ok: true, categories });
      return;
    }

    if (action === "add_category") {
      const trimmedLabel = label?.trim();
      if (!trimmedLabel) {
        response.status(400).json({ ok: false, error: "Nazwa kategorii jest wymagana" });
        return;
      }

      const existingCategories = await listLocalEmojiCategories();
      const [savedCategory] = await upsertLocalEmojiCategoryRows([
        {
          id: randomUUID(),
          label: trimmedLabel,
          sort_order: existingCategories.length,
        },
      ]);

      response.json({ ok: true, category: savedCategory || null });
      return;
    }

    if (action === "seed_default_categories") {
      const cleanLabels = (labels || []).map((item) => item.trim()).filter(Boolean);
      if (cleanLabels.length === 0) {
        response.status(400).json({ ok: false, error: "Brak kategorii do dodania" });
        return;
      }

      const rows = cleanLabels.map((item, index) => ({
        id: randomUUID(),
        label: item,
        sort_order: index,
      }));

      await upsertLocalEmojiCategoryRows(rows);

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "delete_category") {
      if (!categoryId) {
        response.status(400).json({ ok: false, error: "Brak ID kategorii" });
        return;
      }

      await deleteLocalEmojiCategory(categoryId);

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "add_emojis") {
      if (!categoryId || !emojis || emojis.length === 0) {
        response.status(400).json({ ok: false, error: "Kategoria i emoji sa wymagane" });
        return;
      }

      const existingEmojis = await listLocalAdminEmojis(categoryId);
      const baseSortOrder = existingEmojis.length;

      const rows = emojis.map((emoji, index) => ({
        id: randomUUID(),
        category_id: categoryId,
        emoji,
        sort_order: baseSortOrder + index,
      }));

      await upsertLocalAdminEmojiRows(rows);

      response.json({ ok: true, success: true, count: rows.length });
      return;
    }

    if (action === "delete_emoji") {
      if (!emojiId) {
        response.status(400).json({ ok: false, error: "Brak ID emoji" });
        return;
      }

      await deleteLocalAdminEmoji(emojiId);

      response.json({ ok: true, success: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin emojis action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/badges/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, badgeId, badgeKey, packageId, badge } = request.body as AdminBadgeActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["badges", "assets"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do badge'y" });
      return;
    }

    if (action === "list") {
      const [
        badgeRows,
        hiddenRows,
        packageRows,
        accessRows,
      ] = await Promise.all([
        listLocalAdminBadges(),
        listLocalHiddenStaticBadges(),
        listLocalCreditPackages(),
        listLocalBadgePackageAccess(),
      ]);

      const badges = await Promise.all(
        (badgeRows as AdminBadge[]).map(async (row) => ({
          ...row,
          description: row.description || "",
          public_url: await getBadgePublicUrl(row.storage_path),
        }))
      );

      response.json({
        ok: true,
        badges,
        hiddenKeys: (hiddenRows as HiddenStaticBadge[]).map((row) => row.badge_key),
        packages: packageRows,
        access: accessRows || [],
      });
      return;
    }

    if (action === "add") {
      const name = badge?.name?.trim();
      const filePayload = normalizeBase64Payload(badge?.fileBase64);

      if (!name || !filePayload) {
        response.status(400).json({ ok: false, error: "Nazwa i plik badge'a sa wymagane" });
        return;
      }

      const fileBuffer = Buffer.from(filePayload, "base64");
      const savedFile = await saveBadgeFile(badge?.fileName, badge?.fileType, fileBuffer);
      const sortOrder = (await listLocalAdminBadges()).length;
      const [savedBadge] = await upsertLocalAdminBadgeRows([
        {
          id: randomUUID(),
          name,
          description: badge?.description?.trim() || "",
          category: badge?.category || "Inne",
          storage_path: savedFile.storagePath,
          sort_order: sortOrder,
        },
      ]);

      response.json({
        ok: true,
        badge: {
          ...savedBadge,
          public_url: savedFile.publicUrl,
        },
      });
      return;
    }

    if (action === "delete") {
      if (!badgeId) {
        response.status(400).json({ ok: false, error: "Brak ID badge'a" });
        return;
      }

      const existing = await getLocalAdminBadgeById(badgeId);
      if (!existing) {
        response.status(404).json({ ok: false, error: "Nie znaleziono badge'a" });
        return;
      }

      await deleteBadgeFile(existing.storage_path);
      await deleteLocalBadgePackageAccessByBadgeKey(badgeId);
      await deleteLocalAdminBadge(badgeId);

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "hide_static" || action === "show_static") {
      if (!badgeKey) {
        response.status(400).json({ ok: false, error: "Brak klucza badge'a" });
        return;
      }

      if (action === "hide_static") {
        await setLocalStaticBadgeHidden(badgeKey, true);
        response.json({ ok: true, hidden: true });
        return;
      }

      await setLocalStaticBadgeHidden(badgeKey, false);
      response.json({ ok: true, hidden: false });
      return;
    }

    if (action === "toggle_access") {
      if (!badgeKey || !packageId) {
        response.status(400).json({ ok: false, error: "badgeKey i packageId sa wymagane" });
        return;
      }

      const existing = await getLocalBadgePackageAccess(badgeKey, packageId);

      if (existing) {
        await setLocalBadgePackageAccess(badgeKey, packageId, false);
        response.json({ ok: true, enabled: false });
        return;
      }

      await setLocalBadgePackageAccess(badgeKey, packageId, true);
      response.json({ ok: true, enabled: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin badges action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/packages/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, packageId, package: creditPackage } = request.body as AdminPackageActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["credits", "sales"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do pakietow kredytow" });
      return;
    }

    if (action === "list") {
      const packages = await listLocalCreditPackages();
      response.json({ ok: true, packages });
      return;
    }

    if (action === "create") {
      if (!creditPackage?.id || !creditPackage?.label || !creditPackage?.credits || !creditPackage?.price_grosze) {
        response.status(400).json({ ok: false, error: "ID, nazwa, kredyty i cena sa wymagane" });
        return;
      }

      const existingPackage = await getLocalCreditPackageById(creditPackage.id);
      if (existingPackage) {
        response.status(400).json({ ok: false, error: "Pakiet o tym ID juz istnieje" });
        return;
      }

      const [savedPackage] = await upsertLocalCreditPackageRows([
        {
          id: creditPackage.id,
          label: creditPackage.label,
          credits: creditPackage.credits,
          price_grosze: creditPackage.price_grosze,
          popular: creditPackage.popular ?? false,
          active: creditPackage.active ?? true,
          sort_order: creditPackage.sort_order ?? (await getNextLocalCreditPackageSortOrder()),
        },
      ]);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-package-create:${creditPackage.id}:${Date.now()}`,
        title: "Utworzono pakiet kredytów",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          pakiet: creditPackage.id,
          nazwa: creditPackage.label,
          kredyty: creditPackage.credits,
          cenaGrosze: creditPackage.price_grosze,
        },
      });

      response.json({ ok: true, package: savedPackage || null });
      return;
    }

    if (action === "update") {
      if (!packageId) {
        response.status(400).json({ ok: false, error: "Brak ID pakietu" });
        return;
      }

      const updatePayload: Partial<CreditPackage> = {};
      if (creditPackage?.label !== undefined) updatePayload.label = creditPackage.label;
      if (creditPackage?.credits !== undefined) updatePayload.credits = creditPackage.credits;
      if (creditPackage?.price_grosze !== undefined) updatePayload.price_grosze = creditPackage.price_grosze;
      if (creditPackage?.popular !== undefined) updatePayload.popular = creditPackage.popular;
      if (creditPackage?.active !== undefined) updatePayload.active = creditPackage.active;
      if (creditPackage?.sort_order !== undefined) updatePayload.sort_order = creditPackage.sort_order;

      const existingPackage = await getLocalCreditPackageById(packageId);
      if (!existingPackage) {
        response.status(404).json({ ok: false, error: "Nie znaleziono pakietu" });
        return;
      }

      const [savedPackage] = await upsertLocalCreditPackageRows([
        {
          ...existingPackage,
          ...updatePayload,
          id: existingPackage.id,
          updated_at: new Date().toISOString(),
        },
      ]);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-package-update:${packageId}:${Date.now()}`,
        title: "Zmieniono pakiet kredytów",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          pakiet: packageId,
          zmiany: Object.keys(updatePayload).join(", "),
        },
      });

      response.json({ ok: true, package: savedPackage || existingPackage });
      return;
    }

    if (action === "delete") {
      if (!packageId) {
        response.status(400).json({ ok: false, error: "Brak ID pakietu" });
        return;
      }

      await deleteLocalCreditPackage(packageId);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-package-delete:${packageId}:${Date.now()}`,
        title: "Usunięto pakiet kredytów",
        severity: "critical",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          pakiet: packageId,
        },
      });
      response.json({ ok: true, success: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin packages action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/tool-pricing/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, toolId, updates } = request.body as AdminToolPricingActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["toolpricing", "ai"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do cennika narzedzi" });
      return;
    }

    if (action === "list") {
      response.json({ ok: true, tools: await listLocalToolPricing() });
      return;
    }

    if (action === "update") {
      if (!toolId || !updates) {
        response.status(400).json({ ok: false, error: "Brak ID narzedzia lub danych" });
        return;
      }

      const updatePayload: Partial<ToolPrice> & { updated_at?: string } = {
        updated_at: new Date().toISOString(),
      };
      if (updates.credit_cost !== undefined) updatePayload.credit_cost = updates.credit_cost;
      if (updates.active !== undefined) updatePayload.active = updates.active;
      if (updates.access_tier !== undefined) updatePayload.access_tier = updates.access_tier;
      if (updates.visible !== undefined) updatePayload.visible = updates.visible;
      if (updates.popular !== undefined) updatePayload.popular = updates.popular;

      const existingTool = (await listLocalToolPricing()).find((row) => row.id === toolId);
      if (!existingTool) {
        response.status(404).json({ ok: false, error: "Nie znaleziono narzedzia" });
        return;
      }

      const [savedTool] = await upsertLocalToolPricingRows([
        {
          ...existingTool,
          ...updatePayload,
          id: existingTool.id,
          tool_id: existingTool.tool_id,
          label: existingTool.label,
        },
      ]);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-tool-pricing-update:${toolId}:${Date.now()}`,
        title: "Zmieniono cennik narzędzia",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          narzedzie: existingTool.tool_id,
          nazwa: existingTool.label,
          zmiany: Object.keys(updatePayload).join(", "),
          kosztKredytow: updatePayload.credit_cost ?? existingTool.credit_cost,
          aktywne: updatePayload.active ?? existingTool.active,
        },
      });

      response.json({ ok: true, tool: savedTool || existingTool });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin tool pricing action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/stats/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, todayStart, monthStart, fourteenDaysAgo } = request.body as AdminStatsActionBody;

    if (action !== "dashboard") {
      response.status(400).json({ ok: false, error: "Nieznana akcja" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["stats"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do statystyk" });
      return;
    }

    if (!todayStart || !monthStart || !fourteenDaysAgo) {
      response.status(400).json({ ok: false, error: "Brakuje zakresow dat" });
      return;
    }

    const [
      totalGraphics,
      generationsToday,
      purchases,
      recentGraphics,
      allGraphicStyles,
    ] = await Promise.all([
      getLocalGraphicsHistoryCount(),
      getLocalGraphicsHistoryCountSince(todayStart),
      listLocalCreditPurchases({ status: "completed" }),
      listLocalGraphicsHistoryCreatedSince(fourteenDaysAgo),
      listLocalGraphicsHistoryStyles(),
    ]);

    const revenue = purchases.reduce((sum, purchase) => {
      return sum + (purchase.paid_amount != null ? purchase.paid_amount : purchase.amount);
    }, 0);

    const revenueToday = purchases
      .filter((purchase) => (purchase.created_at || "") >= todayStart)
      .reduce((sum, purchase) => sum + (purchase.paid_amount != null ? purchase.paid_amount : purchase.amount), 0);

    const revenueMonth = purchases
      .filter((purchase) => (purchase.created_at || "") >= monthStart)
      .reduce((sum, purchase) => sum + (purchase.paid_amount != null ? purchase.paid_amount : purchase.amount), 0);

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 14; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      dailyMap[date.toISOString().split("T")[0]] = 0;
    }

    recentGraphics.forEach((graphic: { created_at: string | Date | null }) => {
      const day = toDateKey(graphic.created_at);
      if (!day) return;
      if (dailyMap[day] !== undefined) dailyMap[day] += 1;
    });

    const styleMap: Record<string, number> = {};
    allGraphicStyles.forEach((graphicStyle) => {
      const style = graphicStyle || "brak";
      styleMap[style] = (styleMap[style] || 0) + 1;
    });

    response.json({
      ok: true,
      totalGraphics,
      generationsToday,
      totalRevenue: revenue,
      revenueToday,
      revenueMonth,
      dailyGenerations: Object.entries(dailyMap).map(([date, count]) => ({
        date: date.slice(5),
        count,
      })),
      styleDistribution: Object.entries(styleMap).map(([name, value]) => ({ name, value })),
    });
  } catch (error) {
    console.error("VPS admin stats action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/settings/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, entries, force } = request.body as AdminSettingsActionBody;

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["settings"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do ustawien" });
      return;
    }

    if (action === "list") {
      response.json({ ok: true, settings: await listLocalSiteSettings() });
      return;
    }

    if (action === "upsert") {
      if (!Array.isArray(entries)) {
        response.status(400).json({ ok: false, error: "Brak ustawien do zapisu" });
        return;
      }

      const payload = entries.map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const syncedSettings = await upsertLocalSiteSettingsRows(payload);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-settings-upsert:${Date.now()}`,
        title: "Zmieniono ustawienia aplikacji",
        severity: "critical",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          klucze: payload.map((item) => item.key).join(", "),
          liczba: payload.length,
        },
      });
      response.json({ ok: true, settings: syncedSettings });
      return;
    }

    if (action === "run_daily_credits") {
      const result = await grantLocalDailyFreeCredits({ force: Boolean(force) });
      response.json({ ok: true, ...result });
      return;
    }

    if (action === "migrate_core_data") {
      const result = await syncLocalCoreData({ onlyIfEmpty: false });
      response.json(result);
      return;
    }

    if (action === "migrate_storage") {
      response.json({
        ok: true,
        message: "Storage dziala juz na Cloudflare R2. Lokalna migracja nie jest juz potrzebna.",
        graphicsScanned: 0,
        graphicsMigrated: 0,
        badgesScanned: 0,
        badgesMigrated: 0,
      });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin settings action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/content/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, slug, title, content } = request.body as AdminContentActionBody;

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["content"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do tresci" });
      return;
    }

    if (action === "list") {
      response.json({ ok: true, items: await listLocalSiteContent() });
      return;
    }

    if (action === "update") {
      if (!slug) {
        response.status(400).json({ ok: false, error: "Brak slug tresci" });
        return;
      }

      const existingContent = (await listLocalSiteContent()).find((row) => row.slug === slug);
      if (!existingContent) {
        response.status(404).json({ ok: false, error: "Nie znaleziono tresci o podanym slug" });
        return;
      }

      await upsertLocalSiteContentRows([
        {
          ...existingContent,
          title: title ?? existingContent.title,
          content: content ?? existingContent.content,
          updated_by: requestingUserId,
          updated_at: new Date().toISOString(),
        },
      ]);
      response.json({ ok: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin content action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/models/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, modelId, model } = request.body as AdminModelActionBody;

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["models", "ai"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do modeli AI" });
      return;
    }

    if (action === "list") {
      response.json({ ok: true, models: await listLocalAiModels() });
      return;
    }

    if (action === "create") {
      if (!model) {
        response.status(400).json({ ok: false, error: "Brak danych modelu" });
        return;
      }

      if (!model.model_id) {
        response.status(400).json({ ok: false, error: "Brak model_id dla modelu" });
        return;
      }

      const [savedModel] = await upsertLocalAiModelRows([
        {
          id: randomUUID(),
          ...model,
          model_id: model.model_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-model-create:${model.model_id}:${Date.now()}`,
        title: "Dodano model AI",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          modelId: model.model_id,
          nazwa: model.name,
          koszt: model.credit_cost,
        },
      });

      response.json({ ok: true, model: savedModel || null });
      return;
    }

    if (action === "update") {
      if (!modelId || !model) {
        response.status(400).json({ ok: false, error: "Brak ID modelu lub danych" });
        return;
      }

      const existingModel = (await listLocalAiModels()).find((row) => row.id === modelId);
      if (!existingModel) {
        response.status(404).json({ ok: false, error: "Nie znaleziono modelu" });
        return;
      }

      const [savedModel] = await upsertLocalAiModelRows([
        {
          ...existingModel,
          ...model,
          id: existingModel.id,
          model_id: existingModel.model_id,
          updated_at: new Date().toISOString(),
        },
      ]);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-model-update:${modelId}:${Date.now()}`,
        title: "Zmieniono model AI",
        severity: "warning",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          modelId: existingModel.model_id,
          nazwa: existingModel.name,
          zmiany: Object.keys(model).join(", "),
          koszt: model.credit_cost ?? existingModel.credit_cost,
          aktywny: model.active ?? existingModel.active,
        },
      });
      response.json({ ok: true, model: savedModel || existingModel });
      return;
    }

    if (action === "delete") {
      if (!modelId) {
        response.status(400).json({ ok: false, error: "Brak ID modelu" });
        return;
      }

      await deleteLocalAiModel(modelId);
      const actorUser = await getLocalAuthUser(requestingUserId).catch(() => null);
      sendAdminSecurityAlertSoon({
        eventKey: `admin-model-delete:${modelId}:${Date.now()}`,
        title: "Usunięto model AI",
        severity: "critical",
        actorEmail: actorUser?.email,
        actorUserId: requestingUserId,
        request,
        details: {
          modelId,
        },
      });
      response.json({ ok: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin models action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/error-logs/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, source, userId, retentionDays } = request.body as AdminErrorLogActionBody;

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["errors", "users"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do logow bledow" });
      return;
    }

    if (action === "list" || action === "list_user") {
      const logs = await listLocalErrorLogs({
        limit: action === "list_user" ? 100 : 500,
        userId: action === "list_user" ? userId : undefined,
        source: action === "list" ? source : undefined,
      });
      response.json({ ok: true, logs });
      return;
    }

    if (action === "clear_old") {
      const days = Math.max(Number(retentionDays || 30), 1);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      await clearLocalErrorLogsOlderThan(cutoff);
      response.json({ ok: true });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin error logs action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/audit-log/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, search, severity, limit, retentionDays } = request.body as AdminAuditLogActionBody;

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["audit", "errors", "settings"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do historii dzialan" });
      return;
    }

    if (action === "list") {
      const logs = await listAdminAuditLogs({ search, severity, limit });
      response.json({ ok: true, logs });
      return;
    }

    if (action === "clear_old") {
      if (!isSuperAdmin) {
        response.status(403).json({ ok: false, error: "Czyszczenie historii wymaga roli admin" });
        return;
      }

      const deleted = await clearAdminAuditLogsOlderThan(retentionDays);
      response.json({ ok: true, deleted });
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin audit log action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

const isCompanyInvoicePurchase = (purchase: CreditPurchase | null | undefined) => {
  if (!purchase) return false;
  if (String(purchase.billing_type || "").toLowerCase() !== "company") return false;
  if (!String(purchase.billing_company || "").trim()) return false;
  if (!String(purchase.billing_nip || "").trim()) return false;
  return true;
};

const normalizeDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const sanitizeBuyerAddress = (address: unknown, nip: unknown) => {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return "";

  const addressDigits = normalizeDigits(trimmed);
  const nipDigits = normalizeDigits(nip);
  if (addressDigits && nipDigits && addressDigits === nipDigits) {
    return "";
  }

  return trimmed;
};

const VAT_EXEMPT_LEGAL_BASIS = "Art. 113 ust. 1 i 9 ustawy o VAT";

const sendPurchaseToKsef = async (
  purchase: CreditPurchase,
  options: { environment?: string } = {}
) => {
  const ksefSettings = await getLocalSettingsMap(["ksef_enabled", "ksef_token", "ksef_nip", "ksef_environment"]);
  const ksefEnabledValue = String(ksefSettings.ksef_enabled || "true").toLowerCase();
  const ksefEnabled = !["false", "0", "off", "no"].includes(ksefEnabledValue);
  if (!ksefEnabled) {
    throw new Error("KSeF jest wylaczony w ustawieniach administratora.");
  }

  const ksefToken = String(ksefSettings.ksef_token || env.ksefApiToken || "").trim();
  const ksefNip = String(ksefSettings.ksef_nip || env.ksefNip || "").trim();
  const ksefEnvironment = String(ksefSettings.ksef_environment || options.environment || env.ksefEnvironment || "demo").trim();

  if (!ksefToken) {
    throw new Error("KSEF token nie jest skonfigurowany. Ustaw go w Ustawienia -> KSeF.");
  }

  if (!ksefNip) {
    throw new Error("NIP KSeF nie jest skonfigurowany.");
  }

  if (!isCompanyInvoicePurchase(purchase)) {
    throw new Error("Brak pelnych danych firmy do automatycznej wysylki KSeF (typ=firma, nazwa firmy, NIP).");
  }

  const profile = await getLocalProfile(purchase.user_id);
  const sellerData = await getLocalInvoiceSettings({ ensureDefault: true });

  const amountGross = Number(purchase.paid_amount != null ? purchase.paid_amount : purchase.amount);
  const amountGrossPLN = amountGross / 100;
  const netPrice = amountGrossPLN;

  if (!purchase.created_at) {
    throw new Error("Brak daty zakupu.");
  }

  const invoiceDate = new Date(purchase.created_at);
  if (Number.isNaN(invoiceDate.getTime())) {
    throw new Error("Nieprawidlowa data zakupu.");
  }

  const dateStr = invoiceDate.toISOString().split("T")[0];
  const invoiceNumber = [
    "FV",
    String(invoiceDate.getFullYear()),
    String(invoiceDate.getMonth() + 1).padStart(2, "0"),
    purchase.id.slice(0, 8).toUpperCase(),
  ].join("/");

  return sendInvoiceToKsef({
    token: ksefToken,
    nip: ksefNip,
    environment: ksefEnvironment,
    logger: (step, details) => {
      if (details === undefined) {
        console.log(`[ksef:admin] ${step}`);
      } else {
        console.log(`[ksef:admin] ${step}`, details);
      }
    },
    invoice: {
      invoiceNumber,
      issueDate: dateStr,
      salesDate: dateStr,
      seller: {
        nip: ksefNip,
        name: sellerData?.company_name || "Kreator AI",
        address: sellerData?.address || "",
        postalCode: sellerData?.postal_code || "",
        city: sellerData?.city || "",
      },
      buyer: {
        name: purchase.billing_company || purchase.billing_name || profile?.email || "Nabywca",
        nip: purchase.billing_nip || undefined,
        address: sanitizeBuyerAddress(purchase.billing_address, purchase.billing_nip) || undefined,
        postalCode: purchase.billing_postal_code || undefined,
        city: purchase.billing_city || undefined,
        email: profile?.email || undefined,
      },
        items: [
          {
            name: `Pakiet kredytow - ${purchase.credits} szt.`,
            quantity: 1,
            unitPrice: Number(netPrice.toFixed(2)),
            vatRate: "zw",
          },
        ],
        currency: "PLN",
        vatExemptionLegalBasis: VAT_EXEMPT_LEGAL_BASIS,
      },
    });
};

adminRouter.post("/admin/purchases/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, purchaseId, purchase, invoiceSettings, environment } = request.body as AdminPurchaseActionBody;

    if (!action) {
      response.status(400).json({ ok: false, error: "Brak akcji" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["purchases", "sales"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do zakupow" });
      return;
    }

    if (action === "list") {
      const appPurchases = (await listLocalCreditPurchases({ limit: 200 })) as CreditPurchase[];
      const userIds = [...new Set(appPurchases.map((item) => item.user_id).filter(Boolean))];
      const emailMap = new Map<string, string>();

      if (userIds.length > 0) {
        const [profiles, authUsers] = await Promise.all([
          getLocalProfilesByUserIds(userIds),
          getLocalAuthUsersByUserIds(userIds),
        ]);

        profiles.forEach((profile) => {
          if (profile.email) emailMap.set(profile.user_id, profile.email);
        });

        authUsers.forEach((user) => {
          if (user.email) emailMap.set(user.user_id, user.email);
        });
      }

      response.json({
        ok: true,
        purchases: appPurchases.map((item) => ({
          ...item,
          user_email: emailMap.get(item.user_id) || "Nieznany",
        })),
      });
      return;
    }

    if (action === "load_settings") {
      const [invoiceResult, localSettings] = await Promise.all([
        getLocalInvoiceSettings({ ensureDefault: true }),
        getLocalSettingsMap(["ksef_enabled"]),
      ]);

      response.json({
        ok: true,
        invoiceSettings: invoiceResult || null,
        ksefEnabled: (localSettings.ksef_enabled || "true") === "true",
      });
      return;
    }

    if (action === "save_invoice_settings") {
      if (!invoiceSettings?.id) {
        response.status(400).json({ ok: false, error: "Brak ID ustawien faktury" });
        return;
      }

      const [savedInvoiceSettings] = await upsertLocalInvoiceSettingsRows([
        {
          id: invoiceSettings.id,
          company_name: invoiceSettings.company_name,
          nip: invoiceSettings.nip,
          address: invoiceSettings.address,
          postal_code: invoiceSettings.postal_code,
          city: invoiceSettings.city,
          email: invoiceSettings.email,
          updated_at: new Date().toISOString(),
        },
      ]);

      response.json({ ok: true, invoiceSettings: savedInvoiceSettings || null });
      return;
    }

    if (action === "update_purchase") {
      if (!purchaseId || !purchase) {
        response.status(400).json({ ok: false, error: "Brak ID zakupu lub danych" });
        return;
      }

      const existingPurchase = await getLocalCreditPurchaseById(purchaseId);
      if (!existingPurchase) {
        response.status(404).json({ ok: false, error: "Nie znaleziono zakupu" });
        return;
      }

      const updatePayload: Partial<CreditPurchase> = {};
      if (purchase.status !== undefined) updatePayload.status = purchase.status;
      if (purchase.paid_amount !== undefined) updatePayload.paid_amount = purchase.paid_amount;
      if (purchase.billing_company !== undefined) {
        updatePayload.billing_company = String(purchase.billing_company || "").trim() || null;
      }
      if (purchase.billing_nip !== undefined) {
        updatePayload.billing_nip = normalizeDigits(purchase.billing_nip).slice(0, 10) || null;
      }
      if (purchase.billing_address !== undefined) {
        const nextNipForAddress = updatePayload.billing_nip ?? existingPurchase.billing_nip;
        updatePayload.billing_address = sanitizeBuyerAddress(purchase.billing_address, nextNipForAddress) || null;
      }
      if (purchase.billing_postal_code !== undefined) {
        updatePayload.billing_postal_code = String(purchase.billing_postal_code || "").trim() || null;
      }
      if (purchase.billing_city !== undefined) {
        updatePayload.billing_city = String(purchase.billing_city || "").trim() || null;
      }

      const nextStatus = String(updatePayload.status ?? existingPurchase.status ?? "");
      const nextBillingType = String(existingPurchase.billing_type ?? "");
      const nextBillingCompany = String(updatePayload.billing_company ?? existingPurchase.billing_company ?? "").trim();
      const nextBillingNipDigits = String(updatePayload.billing_nip ?? existingPurchase.billing_nip ?? "").replace(/\D/g, "");

      if (nextStatus === "completed" && nextBillingType.toLowerCase() === "company") {
        if (!nextBillingCompany) {
          response.status(400).json({ ok: false, error: "Dla faktury firmowej podaj nazwe firmy przed oznaczeniem zakupu jako oplacony." });
          return;
        }
        if (nextBillingNipDigits.length !== 10) {
          response.status(400).json({ ok: false, error: "Dla faktury firmowej NIP musi miec dokladnie 10 cyfr." });
          return;
        }
      }

      let savedPurchase = await updateLocalCreditPurchase(purchaseId, {
        ...updatePayload,
        updated_at: new Date().toISOString(),
      });

      if (!savedPurchase) {
        response.status(404).json({ ok: false, error: "Nie znaleziono zakupu" });
        return;
      }

      const becameCompleted = existingPurchase.status !== "completed" && savedPurchase.status === "completed";
      let ksefAutoSent = false;
      let ksefAutoError: string | null = null;
      let ksefNumber: string | null = null;

      if (becameCompleted && isCompanyInvoicePurchase(savedPurchase as CreditPurchase)) {
        try {
          const ksefResult = await sendPurchaseToKsef(savedPurchase as CreditPurchase, { environment });
          ksefAutoSent = true;
          ksefNumber = ksefResult.invoiceNumber || ksefResult.invoiceReferenceNumber;
          const updatedAfterKsef = await updateLocalCreditPurchase(savedPurchase.id, {
            ksef_reference_number: ksefResult.invoiceReferenceNumber || null,
            ksef_invoice_number: ksefResult.invoiceNumber || null,
            ksef_session_reference_number: ksefResult.sessionReferenceNumber || null,
            ksef_environment: ksefResult.environment || null,
            ksef_sent_at: new Date().toISOString(),
            ksef_error: null,
            updated_at: new Date().toISOString(),
          });
          if (updatedAfterKsef) {
            savedPurchase = updatedAfterKsef;
          }
        } catch (error) {
          ksefAutoError = error instanceof Error ? error.message : "Nieznany blad wysylki KSeF.";
          await updateLocalCreditPurchase(savedPurchase.id, {
            ksef_error: ksefAutoError,
            updated_at: new Date().toISOString(),
          }).catch(() => null);
          console.error("VPS admin auto KSeF after purchase update failed:", {
            purchaseId: savedPurchase.id,
            error: ksefAutoError,
          });
        }
      }

      response.json({
        ok: true,
        purchase: savedPurchase,
        ksefAutoSent,
        ksefAutoError,
        ksefNumber,
      });
      return;
    }

    if (action === "delete_purchase") {
      if (!purchaseId) {
        response.status(400).json({ ok: false, error: "Brak ID zakupu" });
        return;
      }

      const deleted = await deleteLocalCreditPurchaseById(purchaseId);
      if (!deleted) {
        response.status(404).json({ ok: false, error: "Nie znaleziono zakupu" });
        return;
      }

      response.json({ ok: true, success: true });
      return;
    }

    if (action === "send_ksef") {
      if (!purchaseId) {
        response.status(400).json({ ok: false, error: "Brak ID zakupu" });
        return;
      }

      const purchase = await getLocalCreditPurchaseById(purchaseId);
      if (!purchase) {
        response.status(404).json({ ok: false, error: "Nie znaleziono zakupu." });
        return;
      }

      try {
        const result = await sendPurchaseToKsef(purchase as CreditPurchase, { environment });
        const updatedPurchase = await updateLocalCreditPurchase(purchase.id, {
          ksef_reference_number: result.invoiceReferenceNumber || null,
          ksef_invoice_number: result.invoiceNumber || null,
          ksef_session_reference_number: result.sessionReferenceNumber || null,
          ksef_environment: result.environment || null,
          ksef_sent_at: new Date().toISOString(),
          ksef_error: null,
          updated_at: new Date().toISOString(),
        });

        response.json({
          ok: true,
          success: true,
          purchase: updatedPurchase || purchase,
          ksefNumber: result.invoiceNumber || result.invoiceReferenceNumber,
          elementReferenceNumber: result.invoiceReferenceNumber,
          invoiceReferenceNumber: result.invoiceReferenceNumber,
          sessionReferenceNumber: result.sessionReferenceNumber,
          invoiceNumber: result.invoiceNumber,
          environment: result.environment,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Nieznany blad KSeF.";
        const updatedPurchase = await updateLocalCreditPurchase(purchase.id, {
          ksef_error: errorMessage,
          updated_at: new Date().toISOString(),
        });
        response.status(400).json({
          ok: false,
          error: errorMessage,
          purchase: updatedPurchase || purchase,
        });
      }
      return;
    }

    response.status(400).json({ ok: false, error: "Nieznana akcja" });
  } catch (error) {
    console.error("VPS admin purchases action error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});

adminRouter.post("/admin/public-gallery/actions", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const { action, graphicId } = request.body as AdminPublicGalleryActionBody;

    if (action !== "hide" || !graphicId) {
      response.status(400).json({ ok: false, error: "Nieprawidlowa akcja galerii publicznej" });
      return;
    }

    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["graphics", "assets"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak uprawnien do galerii publicznej" });
      return;
    }

    const hidden = await hideLocalGraphicById(graphicId);
    if (!hidden) {
      response.status(404).json({ ok: false, error: "Nie znaleziono grafiki" });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    console.error("VPS public gallery admin error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie ukryc grafiki.",
    });
  }
});

adminRouter.get("/admin/users", todoRoute({ scope: "admin", action: "list users" }));
adminRouter.get("/admin/users/:id/graphics", todoRoute({ scope: "admin", action: "list selected user graphics" }));
adminRouter.post("/admin/users/:id/reset-password", todoRoute({ scope: "admin", action: "send password reset" }));
adminRouter.patch("/admin/users/:id/password", todoRoute({ scope: "admin", action: "change user password" }));
adminRouter.patch("/admin/users/:id/credits", todoRoute({ scope: "admin", action: "change user credits" }));
adminRouter.patch("/admin/users/:id/admin-role", todoRoute({ scope: "admin", action: "change admin role" }));
adminRouter.patch("/admin/users/:id/panel-role", todoRoute({ scope: "admin", action: "change panel role" }));
adminRouter.delete("/admin/users/:id", todoRoute({ scope: "admin", action: "delete user" }));

adminRouter.get("/admin/coupons", todoRoute({ scope: "admin", action: "list coupons" }));
adminRouter.post("/admin/coupons", todoRoute({ scope: "admin", action: "create coupon" }));
adminRouter.patch("/admin/coupons/:id", todoRoute({ scope: "admin", action: "update coupon" }));
adminRouter.delete("/admin/coupons/:id", todoRoute({ scope: "admin", action: "delete coupon" }));

adminRouter.get("/admin/stripe/overview", todoRoute({ scope: "admin", action: "read Stripe overview" }));
adminRouter.get("/admin/stripe/account", todoRoute({ scope: "admin", action: "read Stripe account details" }));

adminRouter.get("/admin/mailerlite/groups", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["mailerlite"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak dostepu do zakladki MailerLite" });
      return;
    }

    const queryApiKey = typeof request.query.apiKey === "string" ? request.query.apiKey : undefined;
    const key = await getMailerLiteKey(queryApiKey);
    const groups = await fetchMailerLiteGroups(key);

    response.json({ ok: true, groups, connected: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie pobrac grup MailerLite.",
    });
  }
});

adminRouter.post("/admin/mailerlite/config", requireAuthenticatedUser, async (request, response) => {
  try {
    const requestingUserId = request.authUser!.id;
    const isSuperAdmin = await getIsSuperAdmin(requestingUserId);
    if (!(await hasAnyTabAccess(requestingUserId, ["mailerlite"], isSuperAdmin))) {
      response.status(403).json({ ok: false, error: "Brak dostepu do zakladki MailerLite" });
      return;
    }

    const apiKey = typeof request.body?.apiKey === "string" ? request.body.apiKey.trim() : "";
    if (!apiKey) {
      response.status(400).json({ ok: false, error: "Wpisz klucz API MailerLite" });
      return;
    }

    const groups = await fetchMailerLiteGroups(apiKey);
    await upsertLocalMailerLiteConfig(apiKey);

    response.json({ ok: true, groups, connected: true, savedApiKey: "configured" });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Nie udalo sie zapisac konfiguracji MailerLite.",
    });
  }
});
