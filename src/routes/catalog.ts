/**
 * App Catalog endpoints
 * GET /api/v1/catalog/apps          — list all verified apps
 * GET /api/v1/catalog/apps/:id      — single app detail
 * GET /api/v1/catalog/apps?category=food&featured=true  — filtered
 *
 * KV_CATALOG is the primary read source for speed
 * D1 is the source of truth — KV is populated from D1 on write
 * Binding: KV_CATALOG (canonical name — must not change)
 */

import { Env } from '../index';

export async function handleCatalog(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // GET /api/v1/catalog/apps
  if (path === '/api/v1/catalog/apps' && method === 'GET') {
    return await listApps(env, url);
  }

  // GET /api/v1/catalog/apps/:id
  const appDetailMatch = path.match(/^\/api\/v1\/catalog\/apps\/([a-zA-Z0-9\-]+)$/);
  if (appDetailMatch && method === 'GET') {
    return await getApp(env, appDetailMatch[1]);
  }

  return new Response(
    JSON.stringify({ error: 'Catalog route not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function listApps(env: Env, url: URL): Promise<Response> {
  const category = url.searchParams.get('category');
  const featured = url.searchParams.get('featured') === 'true';
  const evosystem = url.searchParams.get('evosystem') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  // Try KV first for speed
  const kvKey = `apps:list:${category || 'all'}:${featured}:${evosystem}`;
  try {
    const cached = await env.KV_CATALOG.get(kvKey, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'kv-cache',
        },
      });
    }
  } catch (_) {
    // KV miss — fall through to D1
  }

  // D1 query
  let query = `
    SELECT
      id, app_name, short_name, category, short_description,
      app_url, icon_r2_key, is_evosystem, is_featured, listing_status,
      created_at
    FROM apps_catalog
    WHERE listing_status = 'verified'
  `;
  const params: (string | number | boolean)[] = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }
  if (featured) {
    query += ` AND is_featured = 1`;
  }
  if (evosystem) {
    query += ` AND is_evosystem = 1`;
  }

  query += ` ORDER BY is_featured DESC, created_at DESC LIMIT ?`;
  params.push(limit);

  const result = await env.DB.prepare(query).bind(...params).all();

  const response = {
    apps: result.results,
    count: result.results.length,
    source: 'd1',
  };

  // Populate KV cache — expires in 5 minutes
  await env.KV_CATALOG.put(kvKey, JSON.stringify(response), {
    expirationTtl: 300,
  });

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'X-Source': 'd1',
    },
  });
}

async function getApp(env: Env, id: string): Promise<Response> {
  // Try KV first
  const kvKey = `apps:detail:${id}`;
  try {
    const cached = await env.KV_CATALOG.get(kvKey, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json', 'X-Source': 'kv-cache' },
      });
    }
  } catch (_) {}

  const app = await env.DB.prepare(`
    SELECT
      ac.*,
      av.status as verification_status,
      av.score as verification_score,
      av.created_at as last_verified_at
    FROM apps_catalog ac
    LEFT JOIN app_verifications av ON av.app_id = ac.id
      AND av.verification_type = 'automated_scan'
    WHERE ac.id = ? AND ac.listing_status = 'verified'
    ORDER BY av.created_at DESC
    LIMIT 1
  `).bind(id).first();

  if (!app) {
    return new Response(
      JSON.stringify({ error: 'App not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Cache for 10 minutes
  await env.KV_CATALOG.put(kvKey, JSON.stringify(app), { expirationTtl: 600 });

  return new Response(JSON.stringify(app), {
    headers: { 'Content-Type': 'application/json', 'X-Source': 'd1' },
  });
}
