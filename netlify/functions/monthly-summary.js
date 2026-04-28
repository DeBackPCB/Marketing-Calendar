/**
 * Netlify Scheduled Function — runs on the 24th of each month at 8am CT
 * Sends each user a summary of next month's events.
 *
 * Schedule: "0 13 24 * *"  (13:00 UTC = 8:00 CT)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const APP_URL      = process.env.APP_URL || 'https://pcb-marketing-calendar.netlify.app';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'Marketing Calendar <noreply@prairiецitybakery.com>';

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.ok ? res.json() : [];
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildEmailHtml(events, monthName, userFirstName) {
  const statusColor = { 'Draft': '#888', 'In Review': '#e67e22', 'Published': '#27ae60', 'Completed': '#2980b9' };
  const rows = events.map(e => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E0D5C0;font-family:Lato,sans-serif;font-size:14px;color:#3D1A0D;font-weight:700;">${e.title}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E0D5C0;font-family:Lato,sans-serif;font-size:13px;color:#5A4030;">${e.event_type}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E0D5C0;font-family:Lato,sans-serif;font-size:13px;color:#5A4030;">${fmtDate(e.start_date)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E0D5C0;">
        <span style="background:${statusColor[e.status]||'#888'};color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${e.status}</span>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F2EBE0;font-family:Lato,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:#FDFAF5;border-radius:12px;overflow:hidden;border:1px solid #E0D5C0;">
    <div style="background:#7B1D2E;padding:24px 28px;border-bottom:4px solid #E8C97A;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.15em;font-weight:900;margin-bottom:6px;">Prairie City Bakery</div>
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:white;">Marketing Calendar</div>
      <div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:4px;">${monthName} Preview</div>
    </div>
    <div style="padding:24px 28px;">
      <p style="font-size:15px;color:#3D1A0D;margin:0 0 20px;">Hi ${userFirstName},</p>
      <p style="font-size:14px;color:#5A4030;line-height:1.6;margin:0 0 24px;">Here's a preview of what's coming up in <strong>${monthName}</strong>. You have <strong>${events.length} event${events.length!==1?'s':''}</strong> scheduled.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E0D5C0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#F2EBE0;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:2px solid #E0D5C0;">Event</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:2px solid #E0D5C0;">Type</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:2px solid #E0D5C0;">Date</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#8a6040;border-bottom:2px solid #E0D5C0;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${APP_URL}" style="background:#7B1D2E;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">View Full Calendar →</a>
      </div>
    </div>
    <div style="background:#F2EBE0;padding:16px 28px;border-top:1px solid #E0D5C0;font-size:11px;color:#8a6040;text-align:center;">
      Prairie City Bakery Marketing Calendar · You're receiving this because you have an account.
    </div>
  </div>
</body>
</html>`;
}

exports.handler = async function() {
  if (!SUPABASE_KEY || !RESEND_KEY) {
    return { statusCode: 500, body: 'Missing SUPABASE_SERVICE_KEY or RESEND_API_KEY' };
  }

  // Next month date range
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endMonth  = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const startStr  = nextMonth.toISOString().slice(0, 10);
  const endStr    = endMonth.toISOString().slice(0, 10);
  const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Fetch next month's events
  const events = await sbGet(`/rest/v1/events?start_date=gte.${startStr}&start_date=lt.${endStr}&order=start_date.asc&select=id,title,event_type,start_date,status`);
  if (!events.length) return { statusCode: 200, body: 'No events next month' };

  // Fetch all users with emails via admin API
  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!usersRes.ok) return { statusCode: 500, body: 'Could not fetch users' };
  const { users } = await usersRes.json();

  let sent = 0;
  for (const user of users) {
    const email = user.email;
    const firstName = user.user_metadata?.full_name?.split(' ')[0] || email.split('@')[0];
    const html = buildEmailHtml(events, monthName, firstName);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `${monthName} Marketing Calendar Preview`,
        html,
      }),
    });
    if (res.ok) sent++;
  }

  return { statusCode: 200, body: JSON.stringify({ sent, month: monthName, events: events.length }) };
};
