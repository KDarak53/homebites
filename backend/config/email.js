const { Resend } = require('resend');

// Real delivery via Resend's HTTP API when configured; falls back to a
// clearly-labeled mock mode for local development/demo — mirrors
// config/payments.js. This uses an HTTP API rather than raw SMTP
// deliberately: confirmed via direct testing that Render (this app's host)
// has no outbound route for SMTP ports at all — connections either hit
// ENETUNREACH (IPv6) or time out (IPv4) regardless of credentials. HTTPS
// (what this API runs over) isn't blocked, the same way MongoDB Atlas and
// Razorpay already work fine from here.
const isConfigured = Boolean(process.env.RESEND_API_KEY);

const resend = isConfigured ? new Resend(process.env.RESEND_API_KEY) : null;

if (!isConfigured) {
  console.warn(
    '[email] RESEND_API_KEY not set — running in MOCK email mode. ' +
      'Verification links will be printed to this console instead of emailed. Add a real key (resend.com) to send actual email.'
  );
}

async function sendVerificationEmail({ to, name, verifyUrl }) {
  if (!isConfigured) {
    console.log(
      `\n[email] MOCK verification email for ${to}:\n  Hi ${name}, verify your HomeBites account here:\n  ${verifyUrl}\n`
    );
    return { mock: true };
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || 'HomeBites <onboarding@resend.dev>',
    to,
    subject: 'Verify your HomeBites account',
    text: `Hi ${name},\n\nVerify your HomeBites account by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your HomeBites account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
  });
  if (error) throw new Error(error.message || 'Resend API error');
  return { mock: false };
}

module.exports = { isConfigured, sendVerificationEmail };
