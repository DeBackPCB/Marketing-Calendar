exports.handler = async function(event) {
  const url = event.queryStringParameters?.url;
  if (!url) return { statusCode: 400, body: JSON.stringify({ error: 'url parameter required' }) };

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingCalendarBot/1.0)' },
      redirect: 'follow'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const meta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1].trim() : '';
    };

    const titleTag = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
    const hostname = new URL(url).hostname.replace('www.', '');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        title:   meta('og:title') || meta('twitter:title') || titleTag,
        snippet: meta('og:description') || meta('twitter:description') || meta('description') || '',
        image:   meta('og:image') || meta('twitter:image') || '',
        source:  meta('og:site_name') || hostname,
        url,
        date:    meta('article:published_time') || meta('og:updated_time') || ''
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
