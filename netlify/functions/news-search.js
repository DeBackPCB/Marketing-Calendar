exports.handler = async function() {
  try {
    // Search multiple queries to maximize coverage
    const queries = [
      '"Prairie City Bakery"',
      '"Prairie City Bakery" site:cspdailynews.com OR site:convenience.org OR site:nrn.com OR site:foodbusinessnews.net OR site:progressivegrocer.com OR site:supermarketnews.com'
    ];

    const allItems = [];
    const seenUrls = new Set();

    for (const q of queries) {
      const encoded = encodeURIComponent(q);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const xml = await res.text();

        // Parse RSS with regex (no external deps)
        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        for (const item of itemMatches) {
          const get = (tag) => {
            const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
            return m ? (m[1] || m[2] || '').trim() : '';
          };
          const link = get('link') || (item.match(/<link\/>([^<]+)/) || [])[1] || '';
          if (!link || seenUrls.has(link)) continue;
          seenUrls.add(link);

          const title   = get('title');
          const pubDate = get('pubDate');
          const source  = get('source') || '';
          const rawDesc = get('description');
          const snippet = rawDesc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
          const dateMs  = pubDate ? new Date(pubDate).getTime() : 0;

          allItems.push({ title, url: link, snippet, source, date: pubDate, dateMs, image: null });
        }
      } catch(e) { /* skip failed query */ }
    }

    // Sort newest first
    allItems.sort((a, b) => b.dateMs - a.dateMs);

    // Remove internal dateMs field before returning
    const articles = allItems.slice(0, 20).map(({ dateMs, ...a }) => a);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(articles)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
