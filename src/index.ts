/**
 * VTL Evosystem — Shared Platform API Worker
 * Platform Interface Specification V1
 * All frontend products call this worker. No product accesses D1 directly.
 */

import { handleHealth } from './routes/health';
import { handleCatalog } from './routes/catalog';
import { handleMembers } from './routes/members';
import { handleSubmissions } from './routes/submissions';
import { handleMenulinx } from './routes/menulinx';
import { handleStripeWebhook } from './routes/stripe';
import { corsHeaders, withCors } from './middleware/cors';
import { withRateLimit } from './middleware/rateLimit';

export interface Env {
  // D1 — canonical binding name: DB
  DB: D1Database;

  // KV — canonical binding names
  KV_CATALOG: KVNamespace;
  KV_CONFIG: KVNamespace;

  // R2 — canonical binding names
  R2_MEDIA: R2Bucket;
  R2_DOCS: R2Bucket;

  // Secrets — set via wrangler secret put
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  // Vars
  ENVIRONMENT: string;
  API_VERSION: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── Route to handlers ──
    try {
      // Health check — no auth required
      if (path === '/api/v1/health') {
        return withCors(await handleHealth(request, env));
      }

      // App catalog — public read
      if (path.startsWith('/api/v1/catalog')) {
        return withCors(await withRateLimit(request, () => handleCatalog(request, env, url)));
      }

      // Member endpoints — auth required in Phase 2, mocked in Phase 1
      if (path.startsWith('/api/v1/members')) {
        return withCors(await handleMembers(request, env, url));
      }

      // Developer submissions — auth required
      if (path.startsWith('/api/v1/submissions')) {
        return withCors(await handleSubmissions(request, env, url));
      }

      // MenuLinx data endpoints
      if (path.startsWith('/api/v1/menulinx')) {
        return withCors(await handleMenulinx(request, env, url));
      }

      // Stripe webhook — raw body required, no CORS
      if (path === '/api/v1/stripe/webhook') {
        return await handleStripeWebhook(request, env);
      }

      // 404 for unknown routes
      return withCors(new Response(
        JSON.stringify({ error: 'Route not found', path }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      ));

    } catch (error) {
      // Global error handler — never expose internals
      console.error('Worker error:', error);
      return withCors(new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      ));
    }
  }
};
