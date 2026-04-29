const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'Marketing Calendar <onboarding@resend.dev>';
const APP_URL      = process.env.APP_URL || 'https://pcb-marketing-calendar.netlify.app';

const LOGO = 'https://mcusercontent.com/b8b83227231f2f0e26759641f/images/f4d5c084-3240-de4a-6231-962425e66050.png';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Shared email wrapper ──────────────────────────────────────────────────────
function emailWrap(preheader, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Prairie City Bakery</title>
</head>
<body style="margin:0;padding:0;background:#F2EBE0;font-family:Georgia,serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F2EBE0;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FDFAF5;border-radius:12px;overflow:hidden;border:1px solid #E0D5C0;">

    <!-- HEADER -->
    <tr>
      <td style="background:#7B1D2E;padding:0;border-bottom:4px solid #E8C97A;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:20px 28px;vertical-align:middle;">
              <img src="${LOGO}" alt="Prairie City Bakery" height="36" style="display:block;margin-bottom:10px;"/>
              <div style="font-family:Georgia,serif;font-size:11px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.18em;font-weight:700;">Prairie City Bakery</div>
              <div style="font-family:Georgia,serif;font-size:20px;font-weight:900;color:white;margin-top:3px;">Marketing Calendar</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:32px 28px;">${body}</td></tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#F2EBE0;padding:16px 28px;border-top:1px solid #E0D5C0;">
        <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#8a6040;text-align:center;line-height:1.6;">
          Prairie City Bakery · Marketing Calendar<br/>
          You're receiving this because you have an account on the marketing calendar.
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(label, url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr><td style="background:#7B1D2E;border-radius:6px;">
      <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:white;text-decoration:none;">${label} →</a>
    </td></tr>
  </table>`;
}

function divider() {
  return `<tr><td style="padding:20px 0;"><div style="height:1px;background:#E0D5C0;"></div></td></tr>`;
}

// ── Template: @mention ────────────────────────────────────────────────────────
function mentionTemplate({ mentionedBy, eventTitle, commentText, recipientName }) {
  const first = recipientName ? recipientName.split(' ')[0] : 'there';
  const body = `
    <p style="font-family:Arial,sans-serif;font-size:15px;color:#3D1A0D;margin:0 0 20px;">Hi ${first},</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#5A4030;line-height:1.6;margin:0 0 24px;">
      <strong style="color:#3D1A0D;">${mentionedBy}</strong> mentioned you in a comment on
      <strong style="color:#7B1D2E;">"${eventTitle}"</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#F2EBE0;border-left:4px solid #E8C97A;border-radius:0 8px 8px 0;padding:14px 18px;">
          <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;margin-bottom:6px;">Comment</div>
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#3D1A0D;line-height:1.6;">${commentText}</div>
        </td>
      </tr>
    </table>
    ${ctaButton('View Comment', APP_URL)}
  `;
  return {
    subject: `${mentionedBy} mentioned you in a comment`,
    html: emailWrap(`${mentionedBy} mentioned you on "${eventTitle}"`, body),
  };
}

// ── Template: Sales request ───────────────────────────────────────────────────
function salesRequestTemplate({ submittedBy, eventTitle, eventType, eventDate }) {
  const fmtDate = eventDate ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—';
  const body = `
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#E8C97A;background:#7B1D2E;display:inline-block;padding:4px 10px;border-radius:4px;margin-bottom:16px;">New Request</div>
    <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#3D1A0D;margin:0 0 8px;">${eventTitle}</h2>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:#5A4030;margin:0 0 24px;">
      Submitted by <strong style="color:#3D1A0D;">${submittedBy}</strong> and is waiting for your review.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E0D5C0;border-radius:8px;overflow:hidden;">
      <tr style="background:#F2EBE0;">
        <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:1px solid #E0D5C0;">Type</td>
        <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:1px solid #E0D5C0;">Date</td>
        <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:1px solid #E0D5C0;">Status</td>
      </tr>
      <tr>
        <td style="padding:12px 14px;font-family:Arial,sans-serif;font-size:14px;color:#3D1A0D;">${eventType}</td>
        <td style="padding:12px 14px;font-family:Arial,sans-serif;font-size:14px;color:#3D1A0D;">${fmtDate}</td>
        <td style="padding:12px 14px;">
          <span style="background:#e67e22;color:white;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:700;">In Review</span>
        </td>
      </tr>
    </table>
    ${ctaButton('Review Request', APP_URL)}
  `;
  return {
    subject: `New Marketing Request: ${eventTitle}`,
    html: emailWrap(`${submittedBy} submitted a new marketing request`, body),
  };
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

  const { type, recipientId, recipientIds, message, eventId, emailTo, emailSubject, emailHtml,
          mentionedBy, eventTitle, commentText, recipientName,
          submittedBy, eventType, eventDate } = body;

  const results = {};

  // In-app notifications
  const userIds = recipientIds || (recipientId ? [recipientId] : []);
  await Promise.all(userIds.map(id => createNotification(id, type, message, eventId)));
  results.notifications = userIds.length;

  // Build branded email based on type
  let finalSubject = emailSubject;
  let finalHtml = emailHtml;

  if (type === 'mention' && mentionedBy && eventTitle) {
    const t = mentionTemplate({ mentionedBy, eventTitle, commentText: commentText || message, recipientName });
    finalSubject = t.subject;
    finalHtml = t.html;
  } else if (type === 'sales_request' && submittedBy && eventTitle) {
    const t = salesRequestTemplate({ submittedBy, eventTitle, eventType: eventType || 'Marketing Request', eventDate });
    finalSubject = t.subject;
    finalHtml = t.html;
  }

  if (emailTo && finalSubject && finalHtml) {
    results.email = await sendEmail(emailTo, finalSubject, finalHtml);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results),
  };
};
