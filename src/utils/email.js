import sgMail from "@sendgrid/mail";

const API_KEY = process.env.SENDGRID_API_KEY || "";
const SENDER = process.env.SENDER_EMAIL || "noreply@example.com";

if (API_KEY) {
  sgMail.setApiKey(API_KEY);
}

export async function sendEmail({ to, subject, text, html }) {
  if (!API_KEY) {
    console.warn("SENDGRID_API_KEY not set - skipping sendEmail", { to, subject });
    return { skipped: true };
  }

  const msg = {
    to,
    from: SENDER,
    subject,
    text,
    html,
  };

  try {
    await sgMail.send(msg);
    return { ok: true };
  } catch (err) {
    console.error("sendEmail error", err?.response?.body || err.message || err);
    throw err;
  }
}
