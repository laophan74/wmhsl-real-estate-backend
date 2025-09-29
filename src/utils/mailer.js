import nodemailer from 'nodemailer';

function getSmtpTransport() {
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
  // Prefer SendGrid (HTTPS) when available — more reliable from serverless platforms.
  const sendGridKey = process.env.SENDGRID_API_KEY;
  const sender = from || process.env.SENDER_EMAIL || process.env.SMTP_USER;

  if (sendGridKey) {
    try {
      // Dynamic import so the code doesn't crash if @sendgrid/mail is not installed.
      const sgMailPkg = await import('@sendgrid/mail').catch(() => null);
      if (sgMailPkg && sgMailPkg.default) {
        const sgMailLocal = sgMailPkg.default;
        sgMailLocal.setApiKey(sendGridKey);
        const msg = { to, from: sender, subject, text, html };
        const res = await sgMailLocal.send(msg);
        console.log('Mailer(SendGrid): message sent', { to, subject, response: res && res[0] && res[0].statusCode });
        return res;
      } else {
        console.warn('Mailer: SENDGRID_API_KEY set but @sendgrid/mail package not installed - skipping SendGrid');
      }
    } catch (err) {
      console.error('Mailer(SendGrid): send error', err && err.stack ? err.stack : err);
      // fallthrough to SMTP fallback
    }
  }

  // Fallback to SMTP (nodemailer)
  const transporter = getSmtpTransport();
  if (!transporter) {
    console.warn('Mailer: no transport configured (no SENDGRID_API_KEY and SMTP creds missing)');
    return null;
  }

  const msg = {
    from: sender,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(msg);
    console.log('Mailer(SMTP): message sent', { to, subject, messageId: info.messageId, response: info.response });
    return info;
  } catch (err) {
    console.error('Mailer(SMTP): send error', err && err.stack ? err.stack : err);
    throw err;
  }
}
