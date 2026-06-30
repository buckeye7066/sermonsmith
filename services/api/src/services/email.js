/**
 * Email service — sends transactional emails via Resend.
 *
 * Set RESEND_API_KEY in .env to enable. If the key is missing, emails are
 * logged to the console instead of sent (safe for local development).
 *
 * Optional env:
 *   EMAIL_FROM — sender address (default: "SermonSmith <noreply@sermonsmith.app>")
 */

import { Resend } from 'resend';

let _resend = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'SermonSmith <noreply@sermonsmith.app>';

/**
 * Send an email. Falls back to console.log when Resend is not configured.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 * @returns {Promise<{ id?: string, fallback?: boolean }>}
 */
export async function sendEmail({ to, subject, html, text }) {
  const resend = getResend();

  if (!resend) {
    console.log(`[Email:dev] To: ${to} | Subject: ${subject}`);
    if (text) console.log(`[Email:dev] Body: ${text}`);
    return { fallback: true };
  }

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) {
    console.error('[Email] Send failed:', error);
    throw new Error(error.message || 'Email send failed');
  }

  console.log(`[Email] Sent to ${to}: ${data.id}`);
  return { id: data.id };
}

// Resolve the public web origin for links in emails. Prefer FRONTEND_URL, then
// the first CORS_ORIGIN entry (always set in prod — see config/env.js), and only
// fall back to localhost in dev. Without the CORS_ORIGIN fallback, a prod deploy
// that set CORS_ORIGIN but forgot FRONTEND_URL shipped reset emails linking to
// http://localhost:5173 — dead links, with no error anywhere.
export function resolveFrontendBaseUrl() {
  const fromFrontend = process.env.FRONTEND_URL?.trim();
  if (fromFrontend) return fromFrontend.replace(/\/+$/, '');
  const fromCors = String(process.env.CORS_ORIGIN || '').split(',')[0]?.trim();
  if (fromCors) return fromCors.replace(/\/+$/, '');
  return 'http://localhost:5173';
}

/**
 * Send a password-reset email with a tokenized link.
 */
export async function sendPasswordResetEmail(email, resetToken) {
  const frontendUrl = resolveFrontendBaseUrl();
  const resetLink = `${frontendUrl}/Login?reset_token=${encodeURIComponent(resetToken)}`;

  return sendEmail({
    to: email,
    subject: 'Reset your SermonSmith password',
    text: `You requested a password reset. Use this link within 15 minutes:\n\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4f46e5;">SermonSmith Password Reset</h2>
        <p>You requested a password reset. Click the button below within <strong>15 minutes</strong>:</p>
        <a href="${resetLink}"
           style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          Or paste this link in your browser:<br/>
          <a href="${resetLink}" style="color: #4f46e5; word-break: break-all;">${resetLink}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip CR/LF so a hostile subject cannot inject extra headers when this
// is interpolated into the email Subject line. Also cap length so an
// abusive sender can't push the subject into a multi-KB blob.
function safeSubject(value) {
  return String(value ?? '').replace(/[\r\n]/g, ' ').slice(0, 200);
}

/**
 * Send a support message confirmation to the user, and a notification to the admin.
 *
 * Every interpolated field is HTML-escaped — without this, a hostile
 * subject/name/email could inject HTML (and a clickable link, or worse,
 * inline JS in mail clients that allow it) into the admin notification.
 */
export async function sendSupportNotification({ userEmail, userName, subject, messageType }) {
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();
  if (!adminEmail) return;

  const safeUserName = escapeHtml(userName);
  const safeUserEmail = escapeHtml(userEmail);
  const safeType = escapeHtml(messageType);
  const safeSubjectText = safeSubject(subject);
  const safeSubjectHtml = escapeHtml(safeSubjectText);

  await sendEmail({
    to: adminEmail,
    subject: `[SermonSmith Support] ${escapeHtml(messageType).slice(0, 60)}: ${safeSubjectText}`,
    text: `New support message from ${userName} (${userEmail}).\n\nType: ${messageType}\nSubject: ${safeSubjectText}\n\nView it in the Admin Messages panel.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4f46e5;">New Support Message</h2>
        <p><strong>From:</strong> ${safeUserName} (${safeUserEmail})</p>
        <p><strong>Type:</strong> ${safeType}</p>
        <p><strong>Subject:</strong> ${safeSubjectHtml}</p>
        <p style="margin-top: 16px;">View and respond in the <strong>Admin Messages</strong> panel.</p>
      </div>
    `,
  });
}
