exports.handler = async function(event) {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'MAILCHIMP_API_KEY not set' }) };
  const dc = apiKey.split('-').pop();

  try {
    const url = `https://${dc}.api.mailchimp.com/3.0/campaigns?count=1000&fields=campaigns.id,campaigns.settings.subject_line,campaigns.settings.title,campaigns.status,campaigns.send_time,campaigns.schedule_time`;
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('anystring:' + apiKey).toString('base64'),
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data.campaigns || [])
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
