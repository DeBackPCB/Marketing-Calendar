const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'Marketing Calendar <onboarding@resend.dev>';
const APP_URL      = process.env.APP_URL || 'https://pcb-marketing-calendar.netlify.app';

const LOGO = 'https://mcusercontent.com/b8b83227231f2f0e26759641f/images/f4d5c084-3240-de4a-6231-962425e66050.png';

// PCB brand palette
const COLOR = {
  crimson:   '#7B1D2E',
  gold:      '#E8C97A',
  cream:     '#FDFAF5',
  bgTan:     '#F2EBE0',
  brownDark: '#3D1A0D',
  brownMid:  '#5A4030',
  mutedTan:  '#A89980',
  border:    '#E0D5C0',
  charcoal:  '#2E2E35',
  white:     '#FFFFFF',
};

// Font stacks: Lato primary (loaded via @import), web-safe fallbacks for Outlook desktop
const FONT_BODY    = `'Lato','Helvetica Neue',Arial,sans-serif`;
const FONT_DISPLAY = `'Playfair Display',Georgia,'Times New Roman',serif`;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Shared email wrapper ──────────────────────────────────────────────────────
function emailWrap(preheader, body) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Prairie City Bakery</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
body{margin:0;padding:0;background:${COLOR.bgTan};}
table{border-collapse:collapse;}
img{display:block;border:0;outline:none;text-decoration:none;}
a{text-decoration:none;}
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.bgTan};font-family:${FONT_BODY};">
<span style="display:none;visibility:hidden;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${COLOR.bgTan};">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bgTan};padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${COLOR.cream};border-radius:12px;overflow:hidden;border:1px solid ${COLOR.border};">

    <!-- HEADER -->
    <tr>
      <td style="background:${COLOR.crimson};padding:24px 28px;border-bottom:4px solid ${COLOR.gold};">
        <img src="${LOGO}" alt="Prairie City Bakery" height="34" style="display:block;margin-bottom:14px;"/>
        <div style="font-family:${FONT_BODY};font-size:11px;color:${COLOR.gold};text-transform:uppercase;letter-spacing:.18em;font-weight:900;">Prairie City Bakery</div>
        <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:900;color:${COLOR.white};margin-top:4px;line-height:1.1;">Marketing Calendar</div>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:32px 28px;background:${COLOR.cream};">${body}</td></tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:${COLOR.charcoal};padding:18px 28px;">
        <p style="margin:0;font-family:${FONT_BODY};font-size:11px;color:${COLOR.mutedTan};text-align:center;line-height:1.7;letter-spacing:.04em;">
          <strong style="color:${COLOR.gold};font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:10px;">Prairie City Bakery</strong><br/>
          Marketing Calendar &middot; You're receiving this because you have an account.
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Brand-aligned eyebrow label (Lato 900 tracked)
function eyebrow(text, color = COLOR.mutedTan) {
  return `<div style="font-family:${FONT_BODY};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${color};margin-bottom:8px;">${text}</div>`;
}

// Brand CTA — crimson, structural color
function ctaButton(label, url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr><td style="background:${COLOR.crimson};border-radius:6px;">
      <a href="${url}" style="display:inline-block;padding:14px 30px;font-family:${FONT_BODY};font-size:13px;font-weight:900;color:${COLOR.white};text-decoration:none;letter-spacing:.06em;text-transform:uppercase;">${label} &rarr;</a>
    </td></tr>
  </table>`;
}

// ── Template: @mention ────────────────────────────────────────────────────────
function mentionTemplate({ mentionedBy, eventTitle, commentText, recipientName }) {
  const first = recipientName ? recipientName.split(' ')[0] : 'there';
  const body = `
    ${eyebrow('You were mentioned')}
    <h2 style="font-family:${FONT_DISPLAY};font-size:24px;font-weight:900;color:${COLOR.brownDark};margin:0 0 18px;line-height:1.2;">Hi ${first} &mdash;<br/>you've got a comment.</h2>
    <p style="font-family:${FONT_BODY};font-size:15px;font-weight:300;color:${COLOR.brownMid};line-height:1.7;margin:0 0 24px;">
      <strong style="font-weight:700;color:${COLOR.brownDark};">${mentionedBy}</strong> mentioned you in a comment on
      <em style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:700;color:${COLOR.crimson};">"${eventTitle}"</em>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      <tr>
        <td style="background:${COLOR.bgTan};border-left:4px solid ${COLOR.gold};border-radius:0 8px 8px 0;padding:18px 22px;">
          ${eyebrow('Comment', COLOR.brownMid)}
          <div style="font-family:${FONT_BODY};font-size:15px;font-weight:300;color:${COLOR.brownDark};line-height:1.7;">${commentText}</div>
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
  const fmtDate = eventDate
    ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const body = `
    <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr><td style="background:${COLOR.gold};border-radius:4px;padding:5px 12px;">
        <span style="font-family:${FONT_BODY};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.brownDark};">&#9733; New Request</span>
      </td></tr>
    </table>
    <h2 style="font-family:${FONT_DISPLAY};font-size:28px;font-weight:900;color:${COLOR.brownDark};margin:0 0 6px;line-height:1.15;">${eventTitle}</h2>
    <p style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:700;font-size:16px;color:${COLOR.crimson};margin:0 0 22px;line-height:1.3;">Submitted and waiting for review.</p>
    <p style="font-family:${FONT_BODY};font-size:15px;font-weight:300;color:${COLOR.brownMid};line-height:1.7;margin:0 0 24px;">
      <strong style="font-weight:700;color:${COLOR.brownDark};">${submittedBy}</strong> has submitted a new marketing request that needs your attention.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR.border};border-radius:8px;overflow:hidden;">
      <tr style="background:${COLOR.crimson};">
        <td style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Type</td>
        <td style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Date</td>
        <td style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Status</td>
      </tr>
      <tr style="background:${COLOR.cream};">
        <td style="padding:14px 16px;font-family:${FONT_BODY};font-size:14px;font-weight:400;color:${COLOR.brownDark};border-bottom:1px solid ${COLOR.border};">${eventType}</td>
        <td style="padding:14px 16px;font-family:${FONT_BODY};font-size:14px;font-weight:400;color:${COLOR.brownDark};border-bottom:1px solid ${COLOR.border};">${fmtDate}</td>
        <td style="padding:14px 16px;border-bottom:1px solid ${COLOR.border};">
          <span style="background:#e67e22;color:${COLOR.white};padding:3px 11px;border-radius:10px;font-family:${FONT_BODY};font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;">In Review</span>
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

  const userIds = recipientIds || (recipientId ? [recipientId] : []);
  await Promise.all(userIds.map(id => createNotification(id, type, message, eventId)));
  results.notifications = userIds.length;

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
