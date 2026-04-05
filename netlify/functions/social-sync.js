exports.handler = async function() {
  const fbToken  = (process.env.FB_PAGE_ACCESS_TOKEN || '').trim();
  const fbPageId = (process.env.FB_PAGE_ID || '').trim();
  const igUserId = (process.env.IG_USER_ID || '').trim();
  const liToken  = (process.env.LINKEDIN_ACCESS_TOKEN || '').trim();
  const liOrgId  = (process.env.LINKEDIN_ORG_ID || '').trim();

  const posts = [];

  // ── Facebook ──────────────────────────────────────────────
  if (fbToken && fbPageId) {
    try {
      const fields = 'id,message,story,created_time,scheduled_publish_time';
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${fbPageId}/posts?fields=${fields}&limit=50&access_token=${fbToken}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      for (const p of data.data || []) {
        const dateStr = p.scheduled_publish_time || p.created_time;
        posts.push({
          id:       `fb_${p.id}`,
          platform: 'Facebook',
          title:    (p.message || p.story || 'Facebook Post').substring(0, 100),
          date:     dateStr ? new Date(dateStr).toISOString().split('T')[0] : '',
          status:   p.scheduled_publish_time ? 'Scheduled' : 'Published',
          url:      `https://facebook.com/${p.id}`
        });
      }
    } catch (e) {
      posts.push({ error: 'Facebook: ' + e.message });
    }
  }

  // ── Instagram ─────────────────────────────────────────────
  if (fbToken && igUserId) {
    try {
      const fields = 'id,caption,media_type,timestamp,permalink';
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media?fields=${fields}&limit=50&access_token=${fbToken}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      for (const p of data.data || []) {
        posts.push({
          id:       `ig_${p.id}`,
          platform: 'Instagram',
          title:    (p.caption || 'Instagram Post').substring(0, 100),
          date:     p.timestamp ? new Date(p.timestamp).toISOString().split('T')[0] : '',
          status:   'Published',
          url:      p.permalink || ''
        });
      }
    } catch (e) {
      posts.push({ error: 'Instagram: ' + e.message });
    }
  }

  // ── LinkedIn ──────────────────────────────────────────────
  if (liToken && liOrgId) {
    try {
      const res = await fetch(
        `https://api.linkedin.com/rest/posts?author=urn%3Ali%3Aorganization%3A${liOrgId}&count=50&q=author`,
        {
          headers: {
            'Authorization': `Bearer ${liToken}`,
            'LinkedIn-Version': '202401',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );
      const data = await res.json();
      if (data.message) throw new Error(data.message);
      for (const p of data.elements || []) {
        const text = p.commentary || p.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || 'LinkedIn Post';
        const ts = p.publishedAt || p.createdAt;
        posts.push({
          id:       `li_${p.id}`,
          platform: 'LinkedIn',
          title:    text.substring(0, 100),
          date:     ts ? new Date(ts).toISOString().split('T')[0] : '',
          status:   p.lifecycleState === 'PUBLISHED' ? 'Published' : 'Draft',
          url:      ''
        });
      }
    } catch (e) {
      posts.push({ error: 'LinkedIn: ' + e.message });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(posts)
  };
};
