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

// Scrape a site's search results page for "Prairie City Bakery" mentions
async function scrapeSite({ searchUrl, source, articlePattern, titleAttr, urlAttr, datePattern, imagePattern, baseUrl }) {
  try {
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();

    const articles = [];
    const blocks = [...html.matchAll(articlePattern)];

    for (const block of blocks.slice(0, 10)) {
      const blockHtml = block[1] || block[0];

      // Extract URL
      const urlMatch = blockHtml.match(/href=["']([^"']+prairie[^"']*city[^"']*baker[^"']*|[^"']*baker[^"']*prairie[^"']*|[^"']+)["']/i);
      const rawUrl = urlMatch ? urlMatch[1] : '';
      if (!rawUrl) continue;
      const url = rawUrl.startsWith('http') ? rawUrl : baseUrl + rawUrl;

      // Extract title
      const titleMatch = blockHtml.match(/<h[1-4][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
                      || blockHtml.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
                      || blockHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      if (!title) continue;

      // Extract date
      const dateMatch = blockHtml.match(/<time[^>]*datetime=["']([^"']+)["']/i)
                     || blockHtml.match(/<time[^>]*>([\w]+ \d+,? \d{4})<\/time>/i)
                     || blockHtml.match(/(\w{3,9} \d{1,2},? \d{4})/);
      const date = dateMatch ? dateMatch[1] : '';

      // Extract image
      const imgMatch = blockHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
      const image = imgMatch ? imgMatch[1] : null;

      // Extract snippet
      const snippetMatch = blockHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      articles.push({ title, url, snippet, source, date, image, dateMs: date ? new Date(date).getTime() : 0 });
    }
    return articles;
  } catch (e) {
    return [];
  }
}

exports.handler = async function() {
  try {
    const allItems = [];
    const seenUrls = new Set();

    // 1. Google News RSS — general web
    try {
      const encoded = encodeURIComponent('"Prairie City Bakery"');
      const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rssUrl);
      if (res.ok) {
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
          const source  = get('source') || new URL(link).hostname.replace('www.','');
          const rawDesc = get('description');
          const imgMatch = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i);
          const snippet = rawDesc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
          allItems.push({ title, url: link, snippet, source, date: pubDate, dateMs: pubDate ? new Date(pubDate).getTime() : 0, image: imgMatch?.[1] || null });
        }
      }
    } catch(e) {}

    // 2. Direct site searches
    const siteSearches = [
      { searchUrl: 'https://csnews.com/?s=prairie+city+bakery', source: 'CSNews', baseUrl: 'https://csnews.com', articlePattern: /<article[\s\S]*?<\/article>/gi },
      { searchUrl: 'https://www.cspdailynews.com/search?q=prairie+city+bakery', source: 'CSP Daily News', baseUrl: 'https://www.cspdailynews.com', articlePattern: /<article[\s\S]*?<\/article>/gi },
      { searchUrl: 'https://cstoredecisions.com/?s=prairie+city+bakery', source: 'C-Store Decisions', baseUrl: 'https://cstoredecisions.com', articlePattern: /<article[\s\S]*?<\/article>/gi },
    ];

    const siteResults = await Promise.all(siteSearches.map(s => scrapeSite(s)));
    for (const results of siteResults) {
      for (const a of results) {
        if (!a.url || seenUrls.has(a.url)) continue;
        seenUrls.add(a.url);
        allItems.push(a);
      }
    }

    // Sort newest first
    allItems.sort((a, b) => b.dateMs - a.dateMs);
    const top = allItems.slice(0, 20);

    // Enrich with OG images in parallel for those missing one
    await Promise.all(top.map(async (a) => {
      if (!a.image) a.image = await fetchOG(a.url);
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
