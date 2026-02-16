/**
 * Developer submission endpoints
 * POST /api/v1/submissions          — submit a new IA for review
 * GET  /api/v1/submissions/:id      — get submission status
 */

import { Env } from '../index';

export async function handleSubmissions(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  // POST /api/v1/submissions
  if (path === '/api/v1/submissions' && method === 'POST') {
    return await createSubmission(request, env);
  }

  // GET /api/v1/submissions/:id
  const statusMatch = path.match(/^\/api\/v1\/submissions\/([a-zA-Z0-9\-]+)$/);
  if (statusMatch && method === 'GET') {
    return await getSubmissionStatus(env, statusMatch[1]);
  }

  return new Response(
    JSON.stringify({ error: 'Submissions route not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function createSubmission(request: Request, env: Env): Promise<Response> {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate required fields
  const required = ['app_name', 'app_url', 'category', 'description'];
  const missing = required.filter(f => !body[f]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields', missing }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Phase 1: member_id from auth header placeholder
  // Phase 2: extract from Cloudflare Access JWT
  const memberId = request.headers.get('X-Member-Id') || 'anonymous';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO developer_submissions
      (id, member_id, app_name, app_url, manifest_url, category, description, submission_notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)
  `).bind(
    id,
    memberId,
    body.app_name,
    body.app_url,
    body.manifest_url || null,
    body.category,
    body.description,
    body.submission_notes || null,
    now,
    now
  ).run();

  return new Response(JSON.stringify({
    success: true,
    submission_id: id,
    status: 'received',
    message: 'Submission received. Automated security scanning will begin shortly.',
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getSubmissionStatus(env: Env, id: string): Promise<Response> {
  const submission = await env.DB.prepare(`
    SELECT id, app_name, status, created_at, updated_at
    FROM developer_submissions
    WHERE id = ?
  `).bind(id).first();

  if (!submission) {
    return new Response(
      JSON.stringify({ error: 'Submission not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(submission), {
    headers: { 'Content-Type': 'application/json' },
  });
}
