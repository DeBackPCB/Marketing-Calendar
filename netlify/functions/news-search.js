exports.handler = async function() {
  const apiKey = (process.env.GOOGLE_SEARCH_API_KEY || '').trim();
  const cx     = (process.env.GOOGLE_SEARCH_CX     || '').trim();

  if (!apiKey || !cx) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Google Search credentials not configured', has: { apiKey: !!apiKey, cx: !!cx } })
    };
  }

  try {
    const query = encodeURIComponent('"Prairie City Bakery"');
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=10&dateRestrict=m6&sort=date`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    const items = (data.items || []).map(item => ({
      title:   item.title,
      snippet: item.snippet,
      url:     item.link,
      source:  item.displayLink,
      image:   item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || null,
      date:    item.pagemap?.metatags?.[0]?.['article:published_time']
            || item.pagemap?.metatags?.[0]?.['og:updated_time']
            || null
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(items)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
