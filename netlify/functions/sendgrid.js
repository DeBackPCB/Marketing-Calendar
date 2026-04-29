const FROM_EMAIL = process.env.SENDGRID_FROM || 'adeback@pcbakery.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'PCB Marketing Calendar';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'SENDGRID_API_KEY not set' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { to, subject, html, text, replyTo } = payload;
  if (!to || !subject || (!html && !text)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'to, subject, and html or text are required' }) };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map(addr => (typeof addr === 'string' ? { email: addr } : addr))
    .filter(r => r && r.email);

  if (!recipients.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No valid recipients' }) };
  }

  const content = [];
  if (text) content.push({ type: 'text/plain', value: text });
  if (html) content.push({ type: 'text/html', value: html });

  const body = {
    personalizations: [{ to: recipients }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    content
  };
  if (replyTo) body.reply_to = { email: replyTo };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: errText }) };
    }

    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
