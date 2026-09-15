import { envHealth } from "./types";

export const resendHealth = () =>
  envHealth("resend", "email", ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], "cloud");

export async function sendResendEmail(input: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}) {
  const health = resendHealth();
  if (!health.configured) throw new Error(`Resend not configured: ${health.missing.join(", ")}`);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend send failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
