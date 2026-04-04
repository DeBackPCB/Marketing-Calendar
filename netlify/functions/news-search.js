async function fetchOG(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return {};
    const html = await res.text();
    const meta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1].trim() : '';
    };
    const titleTag = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
    return {
      image:   meta('og:image') || meta('twitter:image') || null,
      title:   meta('og:title') || meta('twitter:title') || titleTag,
      snippet: meta('og:description') || meta('twitter:description') || meta('description') || '',
      date:    meta('article:published_time') || meta('og:updated_time') || ''
    };
  } catch { return {}; }
}

async function scrapeSite(searchUrl, source, baseUrl) {
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Find all links — keep ones with "prairie" in the href (catches slugs like prairie-city-bakery)
    const linkRe = /<a\s[^>]*href=["']([^"']*prairie[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set();
    const candidates = [];

    let m;
    while ((m = linkRe.exec(html)) !== null) {
      let href = m[1];
      const linkText = m[2].replace(/<[^>]+>/g, '').trim();
      if (!href || !linkText || linkText.length < 10) continue;
      if (!href.startsWith('http')) href = baseUrl + (href.startsWith('/') ? '' : '/') + href;
      if (seen.has(href)) continue;
      seen.add(href);

      // Try to find a nearby date in the surrounding HTML
      const pos = m.index;
      const surrounding = html.slice(Math.max(0, pos - 300), pos + 300);
      const dateMatch = surrounding.match(/<time[^>]*datetime=["']([^"']+)["']/i)
                     || surrounding.match(/(\w{3,9} \d{1,2},? \d{4})/);
      const date = dateMatch ? dateMatch[1] : '';

      candidates.push({ title: linkText, url: href, source, date, snippet: '', image: null, dateMs: date ? new Date(date).getTime() : 0 });
    }

    return candidates.slice(0, 10);
  } catch (e) {
    return [];
  }
}

exports.handler = async function() {
  try {
    const allItems = [];
    const seenUrls = new Set();

    // 1. Google News RSS
    try {
      const encoded = encodeURIComponent('"Prairie City Bakery"');
      const res = await fetch(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`);
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

    // 2. Direct site scrapes
    const sites = [
      { url: 'https://csnews.com/?s=prairie+city+bakery',              source: 'CSNews',           base: 'https://csnews.com' },
      { url: 'https://www.cspdailynews.com/search?q=prairie+city+bakery', source: 'CSP Daily News', base: 'https://www.cspdailynews.com' },
      { url: 'https://cstoredecisions.com/?s=prairie+city+bakery',     source: 'C-Store Decisions', base: 'https://cstoredecisions.com' },
    ];

    const siteResults = await Promise.all(sites.map(s => scrapeSite(s.url, s.source, s.base)));
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

    // Enrich with OG data in parallel (title/snippet/image from the actual article page)
    await Promise.all(top.map(async (a) => {
      if (!a.image || !a.snippet) {
        const og = await fetchOG(a.url);
        if (!a.image)   a.image   = og.image   || null;
        if (!a.snippet) a.snippet = og.snippet  || '';
        if (!a.title || a.title.length < 15) a.title = og.title || a.title;
        if (!a.date)    a.date    = og.date     || '';
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
