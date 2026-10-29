import { env } from "../config/env.js";
import { getLocalEmailTemplateBySlug, getLocalSettingsMap } from "./localCoreData.js";
import { issueLocalPasswordResetToken } from "./localPasswordReset.js";
import { getLocalAuthUserByEmail } from "./localUserData.js";

type TemplateVars = Record<string, string>;

const RESEND_API = "https://api.resend.com/emails";
const LEGACY_RESET_URL_PATTERNS = [
  /\/auth\/v1\/verify/i,
  /ai-art-canvas-38\.[a-z0-9.-]+/i,
];

const replaceVariables = (template: string, vars: TemplateVars) => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
};

const loadAppUrlSettings = async () => {
  const settings = await getLocalSettingsMap(["app_base_url", "app_generator_url", "app_reset_password_url"]);
  const appBaseUrl = normalizeBaseUrl(settings.app_base_url) || normalizeBaseUrl(env.appUrl) || "https://ai-kreator.pl";

  return {
    appBaseUrl,
    generatorUrl: normalizeBaseUrl(settings.app_generator_url) || `${appBaseUrl}/generator`,
    resetPasswordUrl: normalizeBaseUrl(settings.app_reset_password_url) || `${appBaseUrl}/reset-password`,
  };
};

const loadEmailSettings = async () => {
  const settings = await getLocalSettingsMap([
    "email_provider",
    "email_from",
    "email_webhook_url",
    "email_webhook_token",
    "resend_api_key",
  ]);

  return {
    provider: settings.email_provider === "webhook" ? "webhook" : settings.email_provider?.trim() || env.emailProvider,
    from: settings.email_from?.trim() || env.emailFrom,
    resendApiKey: settings.resend_api_key?.trim() || env.resendApiKey,
    webhookUrl: settings.email_webhook_url?.trim() || env.emailWebhookUrl,
    webhookToken: settings.email_webhook_token?.trim() || env.emailWebhookToken,
  };
};

export const sendTransactionalEmail = async (payload: { to: string; subject: string; html: string }) => {
  const settings = await loadEmailSettings();

  if (settings.provider === "webhook") {
    if (!settings.webhookUrl) throw new Error("Brak EMAIL_WEBHOOK_URL w konfiguracji VPS.");

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.webhookToken) headers.Authorization = `Bearer ${settings.webhookToken}`;

    const response = await fetch(settings.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: settings.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) throw new Error(`Email webhook zwrocil blad ${response.status}.`);
    return response.json().catch(() => ({ ok: true }));
  }

  if (!settings.resendApiKey) throw new Error("Brak RESEND_API_KEY w konfiguracji VPS.");

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: settings.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("VPS Resend error:", data);
    throw new Error(`Resend zwrocil blad ${response.status}.`);
  }
  return data;
};

const buildResetFallbackEmail = (resetLink: string, year: number) => ({
  subject: "Reset hasla - Kreator Grafik AI",
  html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#1a1428;font-family:'Segoe UI',sans-serif;color:#e8e0f0"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)"><div style="text-align:center;margin-bottom:28px"><div style="font-size:22px;font-weight:700;color:#f0e8ff">Kreator Grafik AI</div></div><h1 style="font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff">Reset hasla</h1><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px">Kliknij przycisk ponizej, aby ustawic nowe haslo.</p><div style="text-align:center"><a href="${resetLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px">Ustaw nowe haslo</a></div><p style="font-size:15px;line-height:1.7;color:#c4b5d6;margin:0">Link jest wazny przez 60 minut.</p></div><div style="text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
});

const renderResetTemplateHtml = ({
  templateHtml,
  resetLink,
  fallbackHtml,
}: {
  templateHtml: string;
  resetLink: string;
  fallbackHtml: string;
}) => {
  const hasLegacyResetUrl = LEGACY_RESET_URL_PATTERNS.some((pattern) => pattern.test(templateHtml));
  const hasCurrentResetHref = new RegExp(`href=["'][^"']*${escapeRegExp(resetLink)}[^"']*["']`, "i").test(templateHtml);

  if (hasLegacyResetUrl || !hasCurrentResetHref) {
    return fallbackHtml;
  }

  return templateHtml;
};

export const sendResetPasswordEmail = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const appUrls = await loadAppUrlSettings();
  const year = new Date().getFullYear();
  const localAuthUser = await getLocalAuthUserByEmail(normalizedEmail);

  if (!localAuthUser?.user_id) {
    throw new Error("user_not_found");
  }

  const resetToken = await issueLocalPasswordResetToken(localAuthUser.user_id);
  const resetLink = resetToken
    ? `${appUrls.resetPasswordUrl}?token_hash=${encodeURIComponent(resetToken)}&type=recovery`
    : null;

  if (!resetLink) {
    throw new Error("Nie udalo sie wygenerowac linku resetujacego.");
  }

  const tplData = await getLocalEmailTemplateBySlug("reset", true);
  const templateVars = {
    email: normalizedEmail,
    resetLink,
    reset_link: resetLink,
    appBaseUrl: appUrls.appBaseUrl,
    app_base_url: appUrls.appBaseUrl,
    generatorUrl: appUrls.generatorUrl,
    generator_url: appUrls.generatorUrl,
    resetPasswordUrl: appUrls.resetPasswordUrl,
    reset_password_url: appUrls.resetPasswordUrl,
  };
  const fallback = buildResetFallbackEmail(resetLink, year);
  const subject = tplData ? replaceVariables(tplData.subject, templateVars) : fallback.subject;
  const renderedTemplateHtml = tplData ? replaceVariables(tplData.html_content, templateVars) : fallback.html;
  const html = renderResetTemplateHtml({
    templateHtml: renderedTemplateHtml,
    resetLink,
    fallbackHtml: fallback.html,
  });

  await sendTransactionalEmail({ to: normalizedEmail, subject, html });
};
