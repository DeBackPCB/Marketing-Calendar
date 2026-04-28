/**
 * Unified notification sender.
 * Creates an in-app notification in Supabase and sends an email via Resend.
 *
 * POST body:
 *   type        — 'mention' | 'sales_request' | 'monthly_summary'
 *   recipientId — Supabase user UUID (or array for broadcast)
 *   message     — short in-app message
 *   eventId     — optional, linked event ID
 *   emailTo     — email address (or array)
 *   emailSubject
 *   emailHtml
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'Marketing Calendar <noreply@prairiецitybakery.com>';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function createNotification(userId, type, message, eventId) {
  if (!SUPABASE_KEY || !userId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ id: uid(), user_id: userId, type, message, event_id: eventId || null, read: false }),
  });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) return { error: 'No RESEND_API_KEY configured' };
  const toArr = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: toArr, subject, html }),
  });
  return res.ok ? { ok: true } : { error: await res.text() };
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { type, recipientId, recipientIds, message, eventId, emailTo, emailSubject, emailHtml } = body;

  const results = {};

  // In-app notifications
  const userIds = recipientIds || (recipientId ? [recipientId] : []);
  await Promise.all(userIds.map(uid => createNotification(uid, type, message, eventId)));
  results.notifications = userIds.length;

  // Email
  if (emailTo && emailSubject && emailHtml) {
    results.email = await sendEmail(emailTo, emailSubject, emailHtml);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};
