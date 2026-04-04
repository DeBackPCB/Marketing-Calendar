exports.handler = async function() {
  const clientId     = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Zoho credentials not configured' }) };
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
    if (!tokenData.access_token) throw new Error('Failed to refresh token: ' + JSON.stringify(tokenData));
    const auth = `Zoho-oauthtoken ${tokenData.access_token}`;

    // 2. Get portals to find the portal ID
    const portalsRes = await fetch('https://www.zohoapis.com/social/v1/portals', {
      headers: { Authorization: auth }
    });
    const portalsData = await portalsRes.json();
    if (!portalsData.portals?.length) throw new Error('No Zoho Social portals found');
    const portalId = portalsData.portals[0].zsoid || portalsData.portals[0].id;

    // 3. Fetch posts (scheduled + published)
    const postsRes = await fetch(
      `https://www.zohoapis.com/social/v1/${portalId}/posts?count=200`,
      { headers: { Authorization: auth } }
    );
    const postsData = await postsRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(postsData.posts || [])
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
