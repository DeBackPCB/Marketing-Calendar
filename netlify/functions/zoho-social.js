exports.handler = async function() {
  const clientId     = (process.env.ZOHO_CLIENT_ID     || '').trim();
  const clientSecret = (process.env.ZOHO_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.ZOHO_REFRESH_TOKEN || '').trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Zoho credentials not configured', has: { clientId: !!clientId, clientSecret: !!clientSecret, refreshToken: !!refreshToken } }) };
  }

  try {
    // 1. Refresh access token
    const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      }).toString()
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Token refresh failed', detail: tokenData }) };
    }
    const auth = `Zoho-oauthtoken ${tokenData.access_token}`;

    // 2. Get portals
    const portalsRes = await fetch('https://www.zohoapis.com/social/v1/portals', {
      headers: { Authorization: auth }
    });
    const portalsRaw = await portalsRes.text();
    let portalsData;
    try { portalsData = JSON.parse(portalsRaw); } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Portals parse error', detail: portalsRaw }) };
    }
    if (!portalsData.portals?.length) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No portals found', detail: portalsData }) };
    }
    const portal = portalsData.portals[0];
    const portalId = portal.zsoid || portal.portal_id || portal.id;

    // 3. Fetch all posts (published + scheduled)
    const allPosts = [];
    for (const type of ['published', 'scheduled']) {
      const postsRes = await fetch(
        `https://www.zohoapis.com/social/v1/${portalId}/posts?type=${type}&count=100`,
        { headers: { Authorization: auth } }
      );
      const postsRaw = await postsRes.text();
      let postsData;
      try { postsData = JSON.parse(postsRaw); } catch(e) { continue; }
      const list = postsData.posts || (Array.isArray(postsData) ? postsData : []);
      allPosts.push(...list);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(allPosts)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};
