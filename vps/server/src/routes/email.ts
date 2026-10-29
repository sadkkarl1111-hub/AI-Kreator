import { Router } from "express";
import { env } from "../config/env.js";
import {
  getLocalEmailTemplateBySlug,
  getLocalMailerLiteConfig,
  getLocalMailerLitePackageGroupByPackageId,
  getLocalSettingsMap,
} from "../lib/localCoreData.js";
import { hasLocalUserRole } from "../lib/localUserData.js";
import { requireAuthenticatedUser } from "../middleware/requireAuthenticatedUser.js";

type EmailSendBody = {
  type?: string;
  email?: string;
  to?: string | string[];
  subject?: string;
  html?: string;
  resetLink?: string;
  credits?: number | string;
  amount?: number | string;
  variables?: Record<string, unknown>;
};

type MailerLiteSubscribeBody = {
  email?: string;
  groupId?: string;
  packageId?: string;
};

const RESEND_API = "https://api.resend.com/emails";
const MAILERLITE_API_BASE = "https://connect.mailerlite.com/api";

export const emailRouter = Router();

const replaceVariables = (template: string, vars: Record<string, string>) => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
};

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

const sendTransactionalEmail = async (payload: { to: string; subject: string; html: string }) => {
  const settings = await loadEmailSettings();

  if (settings.provider === "webhook") {
    if (!settings.webhookUrl) {
      throw new Error("EMAIL_WEBHOOK_URL is not configured");
    }

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

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Email webhook error:", data);
      throw new Error(`Email webhook error [${response.status}]`);
    }

    return data;
  }

  if (!settings.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

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
    console.error("Resend API error:", data);
    throw new Error(`Resend API error [${response.status}]`);
  }

  return data;
};

const fallbackTemplate = (type: string, vars: Record<string, string>) => {
  const year = new Date().getFullYear();
  const baseStyle = `body{margin:0;padding:0;background:#1a1428;font-family:'Segoe UI',sans-serif;color:#e8e0f0}
  .wrap{max-width:560px;margin:0 auto;padding:40px 20px}
  .card{background:linear-gradient(145deg,#2a1f3d,#1e1530);border-radius:16px;padding:40px 32px;border:1px solid rgba(168,85,247,0.2)}
  .brand{font-size:22px;font-weight:700;color:#f0e8ff;text-align:center;margin-bottom:24px}
  h1{font-size:24px;font-weight:700;margin:0 0 16px;color:#f0e8ff}
  p{font-size:15px;line-height:1.7;color:#c4b5d6;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff!important;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;margin:8px 0 24px}
  .footer{text-align:center;font-size:12px;color:#7c6f8e;margin-top:24px}
  .highlight{color:#a855f7;font-weight:600}`;

  if (type === "welcome") {
    return {
      subject: "Witaj w Kreatorze Grafik AI!",
      html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><style>${baseStyle}</style></head><body><div class="wrap"><div class="card"><div class="brand">Kreator Grafik AI</div><h1>Witaj w Kreatorze Grafik AI!</h1><p>Twoje konto zostalo utworzone i jest gotowe do dzialania.</p><div style="text-align:center"><a href="${vars.generatorUrl || ""}" class="btn">Przejdz do generatora</a></div></div><div class="footer">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
    };
  }

  if (type === "reset") {
    return {
      subject: "Reset hasla - Kreator Grafik AI",
      html: `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><style>${baseStyle}</style></head><body><div class="wrap"><div class="card"><div class="brand">Kreator Grafik AI</div><h1>Reset hasla</h1><p>Kliknij ponizszy przycisk, aby ustawic nowe haslo:</p><div style="text-align:center"><a href="${vars.resetLink || ""}" class="btn">Ustaw nowe haslo</a></div><p>Link jest wazny przez <span class="highlight">60 minut</span>.</p></div><div class="footer">&copy; ${year} Kreator Grafik AI.</div></div></body></html>`,
    };
  }

  return null;
};

const resolveRecipientEmail = (body: EmailSendBody) => {
  if (typeof body.email === "string" && body.email.trim()) return body.email.trim();
  if (typeof body.to === "string" && body.to.trim()) return body.to.trim();
  if (Array.isArray(body.to) && typeof body.to[0] === "string" && body.to[0].trim()) return body.to[0].trim();
  return "";
};

const getMailerLiteKey = async () => {
  const row = await getLocalMailerLiteConfig();
  const key = row?.api_key?.trim();
  if (!key) throw new Error("Brak klucza API MailerLite.");
  return key;
};

const mailerLiteRequest = async <T>(apiKey: string, path: string, options: { method?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${MAILERLITE_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null) as
    | ({ message?: string; error?: string | { message?: string } } & T)
    | null;

  if (!response.ok) {
    const nestedMessage = typeof data?.error === "object" ? data.error.message : data?.error;
    throw new Error(data?.message || nestedMessage || `MailerLite zwrocil blad ${response.status}.`);
  }

  return data as T;
};

emailRouter.post("/email/send", requireAuthenticatedUser, async (request, response) => {
  try {
    const body = (request.body || {}) as EmailSendBody;
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const recipientEmail = resolveRecipientEmail(body);

    if (!recipientEmail) {
      response.status(400).json({ success: false, error: "Email jest wymagany." });
      return;
    }

    if (body.subject && body.html) {
      await sendTransactionalEmail({
        to: recipientEmail,
        subject: String(body.subject),
        html: String(body.html),
      });
      response.json({ success: true });
      return;
    }

    if (!type) {
      response.status(400).json({ success: false, error: "Brak typu szablonu email." });
      return;
    }

    const appUrls = await loadAppUrlSettings();
    const vars: Record<string, string> = {
      email: recipientEmail,
      resetLink: typeof body.resetLink === "string" ? body.resetLink : "",
      credits: body.credits !== undefined ? String(body.credits) : "",
      amount: body.amount !== undefined ? String(body.amount) : "",
      appBaseUrl: appUrls.appBaseUrl,
      generatorUrl: appUrls.generatorUrl,
      resetPasswordUrl: appUrls.resetPasswordUrl,
    };

    if (body.variables && typeof body.variables === "object") {
      for (const [key, value] of Object.entries(body.variables)) {
        vars[key] = value == null ? "" : String(value);
      }
    }

    const template = await getLocalEmailTemplateBySlug(type, true);
    const fallback = fallbackTemplate(type, vars);

    if (!template && !fallback) {
      response.status(400).json({ success: false, error: `Unknown email type: ${type}` });
      return;
    }

    const subject = template ? replaceVariables(template.subject, vars) : fallback!.subject;
    const html = template ? replaceVariables(template.html_content, vars) : fallback!.html;
    const sendResult = await sendTransactionalEmail({ to: recipientEmail, subject, html });
    const messageId =
      sendResult && typeof sendResult === "object" && "id" in sendResult ? (sendResult as { id?: string }).id : null;

    response.json({ success: true, id: messageId ?? null });
  } catch (error) {
    console.error("VPS send-email error:", error);
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

emailRouter.post("/marketing/mailerlite/subscribe", requireAuthenticatedUser, async (request, response) => {
  try {
    const user = request.authUser!;
    const body = (request.body || {}) as MailerLiteSubscribeBody;
    const normalizedBodyEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userEmail = String(user.email || "").trim().toLowerCase();
    const recipientEmail = normalizedBodyEmail || userEmail;

    if (!recipientEmail) {
      response.status(400).json({ ok: false, error: "Brak email." });
      return;
    }

    const isAdmin = await hasLocalUserRole(user.id, "admin");
    if (!isAdmin && normalizedBodyEmail && normalizedBodyEmail !== userEmail) {
      response.status(403).json({ ok: false, error: "Mozesz zapisac tylko swoj adres email." });
      return;
    }

    let groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";

    if (!groupId && typeof body.packageId === "string" && body.packageId.trim()) {
      const mapping = await getLocalMailerLitePackageGroupByPackageId(body.packageId.trim());
      groupId = mapping?.group_id?.trim() || "";
    }

    if (!groupId) {
      response.status(400).json({ ok: false, error: "Brak groupId (lub mapowania packageId -> groupId)." });
      return;
    }

    const apiKey = await getMailerLiteKey();
    await mailerLiteRequest(apiKey, "/subscribers", {
      method: "POST",
      body: {
        email: recipientEmail,
        groups: [groupId],
      },
    });

    response.json({ ok: true, success: true });
  } catch (error) {
    console.error("VPS marketing mailerlite subscribe error:", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Wystapil blad serwera.",
    });
  }
});
