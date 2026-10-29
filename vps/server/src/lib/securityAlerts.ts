import type { Request } from "express";
import { env } from "../config/env.js";
import { getPostgresPool, hasLocalDatabase, ensureLocalDatabaseSchema } from "./postgres.js";
import { sendTransactionalEmail } from "./passwordResetEmail.js";
import { getLocalAuthUsersByUserIds, listLocalUserRoles } from "./localUserData.js";
import { getRequestClientIp } from "../middleware/rateLimit.js";
import { recordAdminAuditLog } from "./adminAuditLog.js";

type SecurityAlertInput = {
  eventKey: string;
  title: string;
  severity?: "info" | "warning" | "critical";
  actorEmail?: string | null;
  actorUserId?: string | null;
  targetEmail?: string | null;
  targetUserId?: string | null;
  details?: Record<string, string | number | boolean | null | undefined>;
  request?: Request;
  cooldownMinutes?: number;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getConfiguredAdminAlertEmails = () =>
  env.adminAlertEmails
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.includes("@"));

const getAdminRecipientEmails = async () => {
  const configuredEmails = getConfiguredAdminAlertEmails();

  try {
    const roles = await listLocalUserRoles();
    const adminUserIds = [...new Set(roles.filter((role) => role.role === "admin").map((role) => role.user_id))];
    const adminUsers = await getLocalAuthUsersByUserIds(adminUserIds);
    const roleEmails = adminUsers
      .map((user) => normalizeEmail(user.email || ""))
      .filter((email) => email.includes("@"));

    return [...new Set([...configuredEmails, ...roleEmails])];
  } catch (error) {
    console.error("Security alert recipients lookup failed:", error);
    return [...new Set(configuredEmails)];
  }
};

const shouldSkipBecauseOfCooldown = async (eventKey: string, cooldownMinutes: number) => {
  if (!hasLocalDatabase() || cooldownMinutes <= 0) return false;

  await ensureLocalDatabaseSchema();
  const { rows } = await getPostgresPool().query<{ exists: boolean }>(
    [
      "SELECT EXISTS (",
      "SELECT 1 FROM security_alert_events",
      "WHERE event_key = $1 AND sent_at > now() - ($2::int * interval '1 minute')",
      ") AS exists",
    ].join(" "),
    [eventKey, cooldownMinutes],
  );

  return Boolean(rows[0]?.exists);
};

const recordAlertEvent = async (eventKey: string, payload: Record<string, unknown>) => {
  if (!hasLocalDatabase()) return;

  await ensureLocalDatabaseSchema();
  await getPostgresPool().query("INSERT INTO security_alert_events (event_key, payload) VALUES ($1, $2::jsonb)", [
    eventKey,
    JSON.stringify(payload),
  ]);
};

const buildRequestDetails = (request?: Request) => {
  if (!request) return {};

  return {
    ip: getRequestClientIp(request),
    userAgent: String(request.headers["user-agent"] || "").slice(0, 240),
  };
};

const buildAlertHtml = (input: SecurityAlertInput, recipients: string[]) => {
  const severity = input.severity || "warning";
  const requestDetails = buildRequestDetails(input.request);
  const rows: Array<[string, unknown]> = [
    ["Poziom", severity],
    ["Aktor", input.actorEmail || input.actorUserId || "-"],
    ["Cel", input.targetEmail || input.targetUserId || "-"],
    ["IP", requestDetails.ip || "-"],
    ["User-Agent", requestDetails.userAgent || "-"],
    ["Odbiorcy", recipients.join(", ")],
    ["Czas", new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })],
    ...Object.entries(input.details || {}),
  ];

  const detailsHtml = rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(
      ([key, value]) =>
        `<tr><td style="padding:8px 10px;color:#6b7280;border-bottom:1px solid #e5e7eb">${escapeHtml(key)}</td><td style="padding:8px 10px;color:#111827;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(value)}</strong></td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#111827"><div style="max-width:680px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><div style="padding:22px 26px;background:linear-gradient(135deg,#a855f7,#ec4899,#38bdf8);color:white"><div style="font-size:13px;opacity:.9">Kreator Grafik AI</div><h1 style="margin:6px 0 0;font-size:22px;line-height:1.25">Alert bezpieczeństwa</h1></div><div style="padding:24px 26px"><h2 style="margin:0 0 14px;font-size:20px">${escapeHtml(input.title)}</h2><p style="margin:0 0 18px;color:#4b5563;line-height:1.6">Wykryto ważne zdarzenie administracyjne. Jeśli to nie Ty, natychmiast sprawdź konto administratora i aktywne sesje.</p><table style="width:100%;border-collapse:collapse;font-size:14px">${detailsHtml}</table></div></div><p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:18px">Ten mail został wysłany automatycznie.</p></div></body></html>`;
};

export const sendAdminSecurityAlert = async (input: SecurityAlertInput) => {
  try {
    const requestDetails = buildRequestDetails(input.request);
    await recordAdminAuditLog({
      eventKey: input.eventKey,
      title: input.title,
      severity: input.severity || "warning",
      actorUserId: input.actorUserId || null,
      actorEmail: input.actorEmail || null,
      targetUserId: input.targetUserId || null,
      targetEmail: input.targetEmail || null,
      ip: typeof requestDetails.ip === "string" ? requestDetails.ip : null,
      userAgent: typeof requestDetails.userAgent === "string" ? requestDetails.userAgent : null,
      details: input.details || {},
    }).catch((error) => console.error("Admin audit log failed:", error));

    const cooldownMinutes = input.cooldownMinutes ?? 0;
    if (await shouldSkipBecauseOfCooldown(input.eventKey, cooldownMinutes)) return;

    const recipients = await getAdminRecipientEmails();
    if (!recipients.length) {
      console.warn("Security alert skipped: no admin recipients configured/found", input.eventKey);
      return;
    }

    const html = buildAlertHtml(input, recipients);
    const subjectPrefix =
      input.severity === "critical" ? "[PILNE]" : input.severity === "info" ? "[INFO]" : "[ALERT]";
    const subject = `${subjectPrefix} Kreator AI - ${input.title}`;

    await Promise.all(recipients.map((to) => sendTransactionalEmail({ to, subject, html })));
    await recordAlertEvent(input.eventKey, {
      ...input,
      request: undefined,
      recipients,
      requestDetails: buildRequestDetails(input.request),
    });
  } catch (error) {
    console.error("Admin security alert failed:", error);
  }
};

export const sendAdminSecurityAlertSoon = (input: SecurityAlertInput) => {
  void sendAdminSecurityAlert(input);
};
