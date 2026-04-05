/**
 * Zoho Flow Webhook Receiver
 * Accepts POST requests from Zoho Flow when a Zoho Social post is created/scheduled.
 * Saves the post as a calendar event in Supabase.
 *
 * Required environment variables (set in Netlify):
 *   SUPABASE_URL        — e.g. https://mkyxbihqlbrmmvclgobc.supabase.co
 *   SUPABASE_SERVICE_KEY — service_role key (not anon) so we can write without a user session
 *   WEBHOOK_SECRET      — a secret string you set in Zoho Flow to verify requests
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkyxbihqlbrmmvclgobc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Map Zoho Social post status to calendar status
function mapStatus(zohoStatus) {
  const s = (zohoStatus || '').toLowerCase();
  if (s === 'published' || s === 'posted') return 'Published';
  if (s === 'scheduled') return 'In Review';
  return 'Draft';
}

// Map Zoho Social network names to readable labels
function mapNetworks(networks) {
  if (!networks) return '';
  const arr = Array.isArray(networks) ? networks : [networks];
  return arr.map(n => {
    const name = (typeof n === 'string' ? n : n.name || '').toLowerCase();
    if (name.includes('facebook')) return 'Facebook';
    if (name.includes('instagram')) return 'Instagram';
    if (name.includes('linkedin')) return 'LinkedIn';
    if (name.includes('twitter') || name.includes('x.com')) return 'X/Twitter';
    return n;
  }).join(', ');
}

exports.handler = async function(event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify secret if configured
  if (WEBHOOK_SECRET) {
    const provided = event.headers['x-webhook-secret'] || event.queryStringParameters?.secret;
    if (provided !== WEBHOOK_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  if (!SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_SERVICE_KEY not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Zoho Flow passes the post data — field names may vary based on how you map them in Flow.
  // We support both raw Zoho Social fields and custom-mapped fields.
  const zohoPostId = payload.post_id || payload.id || payload.postId || '';
  const title      = payload.title || payload.post_title || payload.message?.slice(0, 80) || 'Social Media Post';
  const message    = payload.message || payload.post_message || payload.content || '';
  const status     = mapStatus(payload.status || payload.post_status);
  const networks   = mapNetworks(payload.networks || payload.social_channels || payload.channel);
  const postUrl    = payload.url || payload.post_url || payload.permalink || '';

  // Date: prefer scheduled_time, then published_time, then now
  const rawDate = payload.scheduled_time || payload.published_time || payload.created_time || new Date().toISOString();
  const dateObj  = new Date(rawDate);
  const startDate = isNaN(dateObj) ? new Date().toISOString().slice(0, 10) : dateObj.toISOString().slice(0, 10);

  // Build notes
  const notesParts = [];
  if (networks)   notesParts.push(`Platform: ${networks}`);
  if (message)    notesParts.push(message);
  if (postUrl)    notesParts.push(`Link: ${postUrl}`);
  if (zohoPostId) notesParts.push(`Zoho Post ID: ${zohoPostId}`);
  const notes = notesParts.join('\n');

  // Check for duplicate (same Zoho Post ID)
  if (zohoPostId) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/events?notes=ilike.*Zoho+Post+ID:+${encodeURIComponent(zohoPostId)}*&select=id`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.length > 0) {
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'duplicate', message: 'Post already imported', id: existing[0].id })
        };
      }
    }
  }

  // Insert into Supabase
  const row = {
    id:               uid(),
    title:            title.slice(0, 200),
    event_type:       'Social Media Post',
    start_date:       startDate,
    end_date:         null,
    run_date:         null,
    status:           status,
    priority:         'Medium',
    notes:            notes,
    shared_with_sales: false,
    sales_submitted:   false,
    attachments_json:  '[]',
    comments_json:     '[]',
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!insertRes.ok) {
    const err = await insertRes.json().catch(() => ({}));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase insert failed', detail: err })
    };
  }

  const inserted = await insertRes.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ok', id: inserted[0]?.id })
  };
};
