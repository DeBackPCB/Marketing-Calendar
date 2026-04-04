async function fetchOG(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingCalendarBot/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const meta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1].trim() : '';
    };
    return meta('og:image') || meta('twitter:image') || null;
  } catch { return null; }
}

exports.handler = async function() {
  try {
    const queries = [
      '"Prairie City Bakery"',
      '"Prairie City Bakery" site:cspdailynews.com OR site:csnews.com OR site:cstoredecisions.com OR site:convenience.org OR site:nrn.com OR site:foodbusinessnews.net OR site:progressivegrocer.com OR site:supermarketnews.com'
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

        const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
        for (const item of itemMatches) {
          const get = (tag) => {
            const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
            return m ? (m[1] || m[2] || '').trim() : '';
          };
          const link = (item.match(/<link[^>]*>([^<]+)/) || [])[1]?.trim() || get('link');
          if (!link || seenUrls.has(link)) continue;
          seenUrls.add(link);

          const title   = get('title');
          const pubDate = get('pubDate');
          const source  = get('source') || '';
          const rawDesc = get('description');
          // Try to extract image from RSS description HTML
          const imgMatch = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i);
          const rssImage = imgMatch ? imgMatch[1] : null;
          const snippet  = rawDesc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
          const dateMs   = pubDate ? new Date(pubDate).getTime() : 0;

          allItems.push({ title, url: link, snippet, source, date: pubDate, dateMs, image: rssImage });
        }
      } catch(e) { /* skip failed query */ }
    }

    // Sort newest first
    allItems.sort((a, b) => b.dateMs - a.dateMs);
    const top = allItems.slice(0, 15);

    // Enrich with OG images in parallel (only for articles missing an image)
    await Promise.all(top.map(async (a) => {
      if (!a.image) {
        a.image = await fetchOG(a.url);
      }
    }));

    const articles = top.map(({ dateMs, ...a }) => a);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(articles)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
