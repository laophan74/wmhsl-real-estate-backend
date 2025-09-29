import nodemailer from 'nodemailer';

function buildSmtpTransports() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS; // Gmail App Password
  if (!user || !pass) return [];

  // Try STARTTLS (port 587) first, then SSL (port 465)
  return [
    { host, port: 587, secure: false, requireTLS: true, auth: { user, pass } },
    { host, port: 465, secure: true, auth: { user, pass } },
  ];
}

export async function sendMail({ to, subject, text, html, from }) {
  const sender = from || process.env.SENDER_EMAIL || process.env.SMTP_USER;
  const transports = buildSmtpTransports();

  if (!transports.length) {
    console.warn('Mailer: SMTP_USER or SMTP_PASS missing — no SMTP transport available');
    return null;
  }

  const msg = { from: sender, to, subject, text, html };

  let lastErr = null;
  for (const conf of transports) {
    const transporter = nodemailer.createTransport({
      host: conf.host,
      port: conf.port,
      secure: conf.secure,
      requireTLS: conf.requireTLS || false,
      auth: conf.auth,
      // tune timeouts to be slightly more lenient on serverless platforms
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      tls: { rejectUnauthorized: true },
    });

    try {
      const info = await transporter.sendMail(msg);
      console.log('Mailer(SMTP): message sent', { to, subject, messageId: info.messageId, response: info.response, port: conf.port });
      return info;
    } catch (err) {
      lastErr = err;
      console.error('Mailer(SMTP): send error', { port: conf.port, message: err && err.message });
      // continue to next transport attempt
    }
  }

  // All attempts failed — throw the last error so caller can log/handle.
  console.error('Mailer: all SMTP transports failed', lastErr && lastErr.stack ? lastErr.stack : lastErr);
  throw lastErr;
}
