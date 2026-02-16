/**
 * MenuLinx data endpoints
 * GET /api/v1/menulinx/items            — list menu items
 * GET /api/v1/menulinx/items/:id        — single item
 * POST /api/v1/menulinx/items           — create item (Trade auth required)
 * PATCH /api/v1/menulinx/items/:id      — update item
 * DELETE /api/v1/menulinx/items/:id     — remove item
 *
 * This establishes the Trade IA data pattern used by all subsequent Trade builds
 */

import { Env } from '../index';

export async function handleMenulinx(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // List items
  if (path === '/api/v1/menulinx/items' && method === 'GET') {
    return await listItems(env, url);
  }

  // Create item
  if (path === '/api/v1/menulinx/items' && method === 'POST') {
    return await createItem(request, env);
  }

  // Single item operations
  const itemMatch = path.match(/^\/api\/v1\/menulinx\/items\/([a-zA-Z0-9\-]+)$/);
  if (itemMatch) {
    const id = itemMatch[1];
    if (method === 'GET') return await getItem(env, id);
    if (method === 'PATCH') return await updateItem(request, env, id);
    if (method === 'DELETE') return await deleteItem(env, id);
  }

  return new Response(
    JSON.stringify({ error: 'MenuLinx route not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function listItems(env: Env, url: URL): Promise<Response> {
  const businessId = url.searchParams.get('business_id');
  const category = url.searchParams.get('category');

  let query = `
    SELECT id, business_id, item_name, category, description,
           price, currency, dietary_info, is_available
    FROM menus
    WHERE is_available = 1
  `;
  const params: string[] = [];

  if (businessId) {
    query += ` AND business_id = ?`;
    params.push(businessId);
  }
  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` ORDER BY category, item_name`;

  const result = await env.DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    items: result.results,
    count: result.results.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getItem(env: Env, id: string): Promise<Response> {
  const item = await env.DB.prepare(
    `SELECT * FROM menus WHERE id = ?`
  ).bind(id).first();

  if (!item) {
    return new Response(
      JSON.stringify({ error: 'Item not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(item), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createItem(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const required = ['business_id', 'member_id', 'item_name', 'category'];
  const missing = required.filter(f => !body[f]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields', missing }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO menus
      (id, business_id, member_id, item_name, category, description, price, currency, dietary_info, is_available, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    id,
    body.business_id,
    body.member_id,
    body.item_name,
    body.category,
    body.description || null,
    body.price || null,
    body.currency || 'GBP',
    body.dietary_info ? JSON.stringify(body.dietary_info) : null,
    now,
    now
  ).run();

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function updateItem(request: Request, env: Env, id: string): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const now = new Date().toISOString();
  const fields = ['item_name', 'category', 'description', 'price', 'currency', 'dietary_info', 'is_available'];
  const updates = fields.filter(f => body[f] !== undefined);

  if (updates.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid fields to update' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const setClause = updates.map(f => `${f} = ?`).join(', ');
  const values = updates.map(f => body[f]);

  await env.DB.prepare(
    `UPDATE menus SET ${setClause}, updated_at = ? WHERE id = ?`
  ).bind(...values, now, id).run();

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteItem(env: Env, id: string): Promise<Response> {
  await env.DB.prepare(
    `UPDATE menus SET is_available = 0, updated_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), id).run();

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
