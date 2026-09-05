const sgMail = require('@sendgrid/mail');

// Real delivery via SendGrid's HTTP API when configured; falls back to a
// clearly-labeled mock mode for local development/demo — mirrors
// config/payments.js. HTTP API rather than raw SMTP deliberately: confirmed
// via direct testing that Render (this app's host) has no outbound route
// for SMTP ports at all — connections either hit ENETUNREACH (IPv6) or time
// out (IPv4) regardless of credentials. HTTPS isn't blocked, the same way
// MongoDB Atlas and Razorpay already work fine from here.
//
// SENDGRID_FROM must be an address verified under SendGrid's Single Sender
// Verification (Settings -> Sender Authentication) — sends from an
// unverified address are rejected outright, no domain purchase required.
const isConfigured = Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);

if (isConfigured) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn(
    '[email] SENDGRID_API_KEY/SENDGRID_FROM not set — running in MOCK email mode. ' +
      'Verification links will be printed to this console instead of emailed. Add real SendGrid creds to send actual email.'
  );
}

async function sendVerificationEmail({ to, name, verifyUrl }) {
  if (!isConfigured) {
    console.log(
      `\n[email] MOCK verification email for ${to}:\n  Hi ${name}, verify your HomeBites account here:\n  ${verifyUrl}\n`
    );
    return { mock: true };
  }

  await sgMail.send({
    from: { email: process.env.SENDGRID_FROM, name: 'HomeBites' },
    to,
    subject: 'Verify your HomeBites account',
    text: `Hi ${name},\n\nVerify your HomeBites account by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your HomeBites account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
  });
  return { mock: false };
}

module.exports = { isConfigured, sendVerificationEmail };
