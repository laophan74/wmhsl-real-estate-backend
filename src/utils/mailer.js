import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

function logToFile(entry) {
  try {
    if (process.env.NODE_ENV !== 'development') return;
    const line = `[${new Date().toISOString()}] ${JSON.stringify(entry)}\n`;
    const p = path.resolve(process.cwd(), 'mailer.debug.log');
    fs.appendFileSync(p, line, 'utf8');
  } catch (_) {
    // ignore file logging errors
  }
}

function buildSmtpTransports() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS; // Gmail App Password
  if (!user || !pass) return [];

  const portEnv = Number(process.env.SMTP_PORT || 0);
  const secureEnv = String(process.env.SMTP_SECURE || '').toLowerCase();
  const secureExplicit = secureEnv === 'true' || secureEnv === '1' || secureEnv === 'yes';

  // If explicit port is provided, use it as the only attempt
  if (portEnv > 0) {
    // If user specified secure, respect it; otherwise infer: 465 => secure, else STARTTLS
    const secure = secureEnv ? secureExplicit : portEnv === 465;
    const requireTLS = !secure; // STARTTLS for 587
    return [{ host, port: portEnv, secure, requireTLS, auth: { user, pass } }];
  }

  // Default: Try STARTTLS (587) first, then SSL (465)
  return [
    { host, port: 587, secure: false, requireTLS: true, auth: { user, pass } },
    { host, port: 465, secure: true, auth: { user, pass } },
  ];
}

export async function sendMail({ to, subject, text, html, from }) {
  // Allow disabling emails entirely via env (useful in preview)
  const emailEnabled = String(process.env.EMAIL_ENABLED || 'true').toLowerCase();
  if (emailEnabled === 'false' || emailEnabled === '0' || emailEnabled === 'no') {
    const skip = { to, subject, reason: 'EMAIL_ENABLED=false' };
    console.log('Mailer: skipped by EMAIL_ENABLED', skip);
    logToFile({ level: 'info', event: 'skip_email', ...skip });
    return null;
  }

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
      const success = { to, subject, messageId: info.messageId, response: info.response, port: conf.port };
      console.log('Mailer(SMTP): message sent', success);
      logToFile({ level: 'info', event: 'smtp_sent', ...success });
      return info;
    } catch (err) {
      lastErr = err;
      const fail = { port: conf.port, message: err && err.message };
      console.error('Mailer(SMTP): send error', fail);
      logToFile({ level: 'error', event: 'smtp_error', ...fail });
      // continue to next transport attempt
    }
  }

  // All attempts failed — throw the last error so caller can log/handle.
  console.error('Mailer: all SMTP transports failed', lastErr && lastErr.stack ? lastErr.stack : lastErr);
  logToFile({ level: 'error', event: 'smtp_all_failed', error: lastErr && (lastErr.stack || lastErr.message || String(lastErr)) });
  throw lastErr;
}
