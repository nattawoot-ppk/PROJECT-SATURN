/**
 * Email delivery for magic links. Providers (checked in order): Resend (RESEND_API_KEY), generic webhook
 * (EMAIL_WEBHOOK_URL receives JSON {to, subject, text, html}), otherwise "dev" which logs and returns the link.
 */
export interface Mail { to: string; subject: string; text: string; html: string }
export type MailResult = { provider: "resend" | "webhook" | "dev"; ok: boolean; error?: string };

export async function sendMail(m: Mail, log: (o: object, msg: string) => void): Promise<MailResult> {
  const from = process.env.EMAIL_FROM ?? "SATRN <no-reply@saturn.local>";
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html }) });
    if (!res.ok) { const err = await res.text(); log({ err }, "resend failed"); return { provider: "resend", ok: false, error: err.slice(0, 200) }; }
    return { provider: "resend", ok: true };
  }
  if (process.env.EMAIL_WEBHOOK_URL) {
    const res = await fetch(process.env.EMAIL_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ from, ...m }) });
    return { provider: "webhook", ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  }
  log({ to: m.to, subject: m.subject }, "dev mail (no provider configured)");
  return { provider: "dev", ok: true };
}

export function magicLinkMail(to: string, link: string): Mail {
  return { to, subject: "Your SATRN sign-in link", text: `Sign in to SATRN: ${link}\n\nThe link is valid for 15 minutes and can be used once.`, html: `<p>Sign in to <strong>SATRN</strong>:</p><p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#ff5a1f;color:#fff;border-radius:999px;text-decoration:none">Open SATRN</a></p><p style="color:#6b7380;font-size:12px">Valid for 15 minutes, single use.</p>` };
}
