const nodemailer = require('nodemailer');

// Real SMTP delivery when configured; falls back to a clearly-labeled mock
// mode for local development/demo — mirrors config/payments.js. In mock
// mode the verification link is printed to the server console instead of
// emailed, so the signup flow stays fully testable without mail infra.
const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

if (!isConfigured) {
  console.warn(
    '[email] SMTP_HOST/SMTP_USER/SMTP_PASS not set — running in MOCK email mode. ' +
      'Verification links will be printed to this console instead of emailed. Add real SMTP creds to .env to send actual email.'
  );
}

async function sendVerificationEmail({ to, name, verifyUrl }) {
  if (!isConfigured) {
    console.log(
      `\n[email] MOCK verification email for ${to}:\n  Hi ${name}, verify your HomeBites account here:\n  ${verifyUrl}\n`
    );
    return { mock: true };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Verify your HomeBites account',
    text: `Hi ${name},\n\nVerify your HomeBites account by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your HomeBites account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
  });
  return { mock: false };
}

module.exports = { isConfigured, sendVerificationEmail };
