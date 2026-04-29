const FROM_EMAIL = process.env.SENDGRID_FROM || 'adeback@pcbakery.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'PCB Marketing Calendar';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function isSevenDaysBeforeNextMonth(today) {
  const target = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  target.setDate(target.getDate() - 7);
  return ymd(today) === ymd(target);
}

async function sbSelect(path) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${url}${path}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildDigestHTML(events, monthLabel) {
  const rows = events.map(e => {
    const d = new Date(e.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = e.end_date ? ' – ' + new Date(e.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap;font-weight:600;">${d}${end}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${e.title}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${e.event_type || ''}</td></tr>`;
  }).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#333;">
    <h2 style="color:#8b3a1f;">Upcoming Marketing Events &mdash; ${monthLabel}</h2>
    <p>Here's what's on the calendar for next month:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <p style="margin-top:24px;color:#666;font-size:12px;">PCB Marketing Calendar &middot; Monthly Digest</p>
  </div>`;
}

async function sendEmail(to, subject, html) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
}

const handler = async function() {
  const today = new Date();
  const force = process.env.DIGEST_FORCE === '1';
  if (!force && !isSevenDaysBeforeNextMonth(today)) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not 7 days before next month' }) };
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthAfter = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  const monthLabel = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  try {
    const events = await sbSelect(
      `/rest/v1/events?select=title,event_type,start_date,end_date,shared_with_sales` +
      `&shared_with_sales=eq.true` +
      `&start_date=gte.${ymd(nextMonth)}` +
      `&start_date=lt.${ymd(monthAfter)}` +
      `&order=start_date.asc`
    );

    if (!events.length) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'no events next month' }) };
    }

    const sales = await sbSelect(`/rest/v1/profiles?select=email&role=eq.sales`);
    const recipients = sales.map(p => p.email).filter(Boolean);
    if (!recipients.length) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'no sales recipients' }) };
    }

    const html = buildDigestHTML(events, monthLabel);
    const subject = `Marketing Calendar — ${monthLabel} Digest`;

    const results = await Promise.allSettled(recipients.map(to => sendEmail(to, subject, html)));
    const failed = results.filter(r => r.status === 'rejected').length;

    return { statusCode: 200, body: JSON.stringify({ sent: recipients.length - failed, failed, monthLabel }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.handler = handler;
exports.config = { schedule: '0 13 * * *' };
