import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS; // Gmail App Password

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, text, html, from }) {
  const transporter = getTransport();
  if (!transporter) {
    console.warn('Mailer not configured: SMTP_USER or SMTP_PASS missing');
    return null;
  }

  const msg = {
    from: from || process.env.SENDER_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(msg);
    console.log('Mailer: message sent', { to, subject, messageId: info.messageId, response: info.response });
    return info;
  } catch (err) {
    console.error('Mailer: send error', err && err.stack ? err.stack : err);
    throw err;
  }
}
