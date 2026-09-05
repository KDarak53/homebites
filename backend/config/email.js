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
      'Emails will be printed to this console instead of sent. Add real SendGrid creds to send actual email.'
  );
}

async function send({ to, subject, text, html }) {
  if (!isConfigured) {
    console.log(`\n[email] MOCK email for ${to}:\n  Subject: ${subject}\n  ${text}\n`);
    return { mock: true };
  }

  await sgMail.send({ from: { email: process.env.SENDGRID_FROM, name: 'HomeBites' }, to, subject, text, html });
  return { mock: false };
}

function sendVerificationEmail({ to, name, verifyUrl }) {
  return send({
    to,
    subject: 'Verify your HomeBites account',
    text: `Hi ${name},\n\nVerify your HomeBites account by opening this link:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Verify your HomeBites account by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
  });
}

// Sent when an admin approves or rejects a vendor's kitchen listing — the
// in-app notification (services/notify.js) only reaches them if they happen
// to be logged in at that moment, which after registering and waiting for
// moderation they usually aren't.
function sendVendorApprovalEmail({ to, name, businessName, approved, reason }) {
  if (approved) {
    return send({
      to,
      subject: `${businessName} is now live on HomeBites!`,
      text: `Hi ${name},\n\nGreat news — ${businessName} has been approved and is now visible to customers on HomeBites.\n\nLog in to manage your menu and orders: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor`,
      html: `<p>Hi ${name},</p><p>Great news — <strong>${businessName}</strong> has been approved and is now visible to customers on HomeBites.</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor">Log in to manage your menu and orders</a></p>`,
    });
  }
  return send({
    to,
    subject: `${businessName} needs attention before it can go live`,
    text: `Hi ${name},\n\nYour kitchen listing for ${businessName} wasn't approved yet.\n\n${reason || 'Please check your FSSAI license and details.'}\n\nLog in to review and update: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor`,
    html: `<p>Hi ${name},</p><p>Your kitchen listing for <strong>${businessName}</strong> wasn't approved yet.</p><p>${reason || 'Please check your FSSAI license and details.'}</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor">Log in to review and update</a></p>`,
  });
}

// Sent when an admin pauses or resumes a vendor's kitchen — an override
// distinct from approve/reject (see VendorProfile.isSuspendedByAdmin) that
// can happen at any point in a kitchen's lifetime, not just at onboarding.
function sendVendorSuspensionEmail({ to, name, businessName, suspended, reason }) {
  if (suspended) {
    return send({
      to,
      subject: `${businessName} has been paused on HomeBites`,
      text: `Hi ${name},\n\n${businessName} has been paused by HomeBites and is temporarily not visible to customers or accepting orders.\n\n${reason || 'Contact HomeBites support for details.'}\n\nLog in for more: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor`,
      html: `<p>Hi ${name},</p><p><strong>${businessName}</strong> has been paused by HomeBites and is temporarily not visible to customers or accepting orders.</p><p>${reason || 'Contact HomeBites support for details.'}</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor">Log in for more</a></p>`,
    });
  }
  return send({
    to,
    subject: `${businessName} is active again on HomeBites`,
    text: `Hi ${name},\n\nGood news — ${businessName} has been resumed and is visible to customers and accepting orders again.\n\nLog in to manage your kitchen: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor`,
    html: `<p>Hi ${name},</p><p>Good news — <strong>${businessName}</strong> has been resumed and is visible to customers and accepting orders again.</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login-vendor">Log in to manage your kitchen</a></p>`,
  });
}

// Sent when an admin asks a vendor to fix something during onboarding
// review, without rejecting them outright — a constructive middle ground
// between "approved" and "rejected" (see VendorProfile.changesRequestedReason).
function sendVendorChangesRequestedEmail({ to, name, businessName, reason }) {
  return send({
    to,
    subject: `Action needed on your ${businessName} application`,
    text: `Hi ${name},\n\nBefore we can approve ${businessName}, please fix the following:\n\n${reason}\n\nUpdate your details and resubmit for review: ${process.env.CLIENT_URL || 'http://localhost:5173'}/vendor/settings`,
    html: `<p>Hi ${name},</p><p>Before we can approve <strong>${businessName}</strong>, please fix the following:</p><p>${reason}</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/vendor/settings">Update your details and resubmit for review</a></p>`,
  });
}

module.exports = {
  isConfigured,
  sendVerificationEmail,
  sendVendorApprovalEmail,
  sendVendorSuspensionEmail,
  sendVendorChangesRequestedEmail,
};
