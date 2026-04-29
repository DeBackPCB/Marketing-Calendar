/**
 * Netlify Scheduled Function — runs on the 24th of each month at 8am CT.
 * Sends each user a brand-styled summary of next month's events.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const APP_URL      = process.env.APP_URL || 'https://pcb-marketing-calendar.netlify.app';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'Marketing Calendar <onboarding@resend.dev>';

const LOGO = 'https://mcusercontent.com/b8b83227231f2f0e26759641f/images/f4d5c084-3240-de4a-6231-962425e66050.png';

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
  charcoalAlt: '#3A3A42',
  white:     '#FFFFFF',
};

const FONT_BODY    = `'Lato','Helvetica Neue',Arial,sans-serif`;
const FONT_DISPLAY = `'Playfair Display',Georgia,'Times New Roman',serif`;

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
  const rows = events.map((e, i) => {
    const bg = i % 2 === 0 ? COLOR.cream : COLOR.bgTan;
    return `
    <tr style="background:${bg};">
      <td style="padding:14px 16px;border-bottom:1px solid ${COLOR.border};font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${COLOR.brownDark};">${e.title}</td>
      <td style="padding:14px 16px;border-bottom:1px solid ${COLOR.border};font-family:${FONT_BODY};font-size:13px;font-weight:400;color:${COLOR.brownMid};">${e.event_type}</td>
      <td style="padding:14px 16px;border-bottom:1px solid ${COLOR.border};font-family:${FONT_BODY};font-size:13px;font-weight:400;color:${COLOR.brownMid};">${fmtDate(e.start_date)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid ${COLOR.border};">
        <span style="background:${statusColor[e.status]||'#888'};color:${COLOR.white};padding:3px 11px;border-radius:10px;font-family:${FONT_BODY};font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;">${e.status}</span>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${monthName} Preview &middot; Prairie City Bakery</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap');
body{margin:0;padding:0;background:${COLOR.bgTan};}
table{border-collapse:collapse;}
img{display:block;border:0;}
a{text-decoration:none;}
</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.bgTan};font-family:${FONT_BODY};">
<span style="display:none;visibility:hidden;max-height:0;overflow:hidden;font-size:1px;color:${COLOR.bgTan};">${events.length} events scheduled for ${monthName}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bgTan};padding:32px 16px;">
  <tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${COLOR.cream};border-radius:12px;overflow:hidden;border:1px solid ${COLOR.border};">

    <!-- HEADER -->
    <tr>
      <td style="background:${COLOR.crimson};padding:24px 28px;border-bottom:4px solid ${COLOR.gold};">
        <img src="${LOGO}" alt="Prairie City Bakery" height="34" style="display:block;margin-bottom:14px;"/>
        <div style="font-family:${FONT_BODY};font-size:11px;color:${COLOR.gold};text-transform:uppercase;letter-spacing:.18em;font-weight:900;">Prairie City Bakery</div>
        <div style="font-family:${FONT_DISPLAY};font-size:22px;font-weight:900;color:${COLOR.white};margin-top:4px;line-height:1.1;">Marketing Calendar</div>
        <div style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:700;font-size:14px;color:${COLOR.gold};margin-top:8px;">${monthName} preview</div>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:32px 28px;background:${COLOR.cream};">
      <div style="font-family:${FONT_BODY};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.mutedTan};margin-bottom:8px;">A Look Ahead</div>
      <h2 style="font-family:${FONT_DISPLAY};font-size:26px;font-weight:900;color:${COLOR.brownDark};margin:0 0 6px;line-height:1.2;">Hi ${userFirstName} &mdash;<br/>here's what's coming.</h2>
      <p style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:700;font-size:16px;color:${COLOR.crimson};margin:0 0 20px;line-height:1.3;">${events.length} event${events.length!==1?'s':''} on the ${monthName} calendar.</p>
      <p style="font-family:${FONT_BODY};font-size:15px;font-weight:300;color:${COLOR.brownMid};line-height:1.7;margin:0 0 28px;">
        A quick look at everything scheduled to publish, run, or wrap in <strong style="font-weight:700;color:${COLOR.brownDark};">${monthName}</strong>. Click any item in the calendar for full details.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR.border};border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:${COLOR.crimson};">
            <th align="left" style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Event</th>
            <th align="left" style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Type</th>
            <th align="left" style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Date</th>
            <th align="left" style="padding:11px 16px;font-family:${FONT_BODY};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:${COLOR.gold};">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr><td style="background:${COLOR.crimson};border-radius:6px;">
          <a href="${APP_URL}" style="display:inline-block;padding:14px 30px;font-family:${FONT_BODY};font-size:13px;font-weight:900;color:${COLOR.white};text-decoration:none;letter-spacing:.06em;text-transform:uppercase;">View Full Calendar &rarr;</a>
        </td></tr>
      </table>
    </td></tr>

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

  // Fetch all users via admin API
  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!usersRes.ok) return { statusCode: 500, body: 'Could not fetch users' };
  const { users } = await usersRes.json();

  let sent = 0;
  for (const user of users) {
    const email = user.email;
    if (!email) continue;
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
