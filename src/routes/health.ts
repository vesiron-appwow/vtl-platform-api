/**
 * Health check endpoint
 * GET /api/v1/health
 * No auth required — confirms worker is alive and bindings are wired
 */

import { Env } from '../index';

export async function handleHealth(request: Request, env: Env): Promise<Response> {
  // Verify DB binding is present
  const dbStatus = env.DB ? 'connected' : 'missing';

  // Verify KV bindings
  const kvCatalogStatus = env.KV_CATALOG ? 'connected' : 'missing';
  const kvConfigStatus = env.KV_CONFIG ? 'connected' : 'missing';

  // Verify R2 bindings
  const r2MediaStatus = env.R2_MEDIA ? 'connected' : 'missing';
  const r2DocsStatus = env.R2_DOCS ? 'connected' : 'missing';

  const allHealthy =
    dbStatus === 'connected' &&
    kvCatalogStatus === 'connected' &&
    kvConfigStatus === 'connected' &&
    r2MediaStatus === 'connected' &&
    r2DocsStatus === 'connected';

  const body = {
    status: allHealthy ? 'ok' : 'degraded',
    version: env.API_VERSION || 'v1',
    environment: env.ENVIRONMENT || 'unknown',
    timestamp: new Date().toISOString(),
    bindings: {
      DB: dbStatus,
      KV_CATALOG: kvCatalogStatus,
      KV_CONFIG: kvConfigStatus,
      R2_MEDIA: r2MediaStatus,
      R2_DOCS: r2DocsStatus,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
