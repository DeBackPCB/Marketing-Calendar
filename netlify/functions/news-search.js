const { DOMParser } = require('@xmldom/xmldom');

exports.handler = async function() {
  try {
    const query = encodeURIComponent('"Prairie City Bakery"');
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
    const xml = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = Array.from(doc.getElementsByTagName('item')).slice(0, 15);

    const articles = items.map(item => {
      const get = tag => item.getElementsByTagName(tag)[0]?.textContent || '';
      const title = get('title');
      const link  = get('link');
      const pubDate = get('pubDate');
      const source = get('source') || new URL(link).hostname.replace('www.','');
      // Strip HTML from description
      const rawDesc = get('description');
      const snippet = rawDesc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();

      return { title, url: link, snippet, source, date: pubDate, image: null };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(articles)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
