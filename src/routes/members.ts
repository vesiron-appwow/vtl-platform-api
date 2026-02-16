/**
 * Members endpoints
 * GET /api/v1/members/me  — current member profile and entitlements
 *
 * Phase 1: Returns mocked response so UI state logic can be built now
 * Phase 2: Real Cloudflare Access JWT validation + D1 lookup
 *
 * CRITICAL: IAs must build UI state based on this response from day one
 * so entitlement logic requires no rebuild when real auth is enabled
 */

import { Env } from '../index';

export async function handleMembers(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname;

  // GET /api/v1/members/me
  if (path === '/api/v1/members/me' && request.method === 'GET') {
    return await getMe(request, env);
  }

  return new Response(
    JSON.stringify({ error: 'Members route not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}

async function getMe(request: Request, env: Env): Promise<Response> {
  // Phase 1: Mocked response
  // The shape of this response is canonical — UI must be built against this shape
  // Phase 2: Replace with real Cloudflare Access JWT validation

  if (env.ENVIRONMENT !== 'production') {
    // Development mock — returns a myLynx-gold member for UI testing
    return new Response(JSON.stringify({
      authenticated: true,
      member: {
        id: 'mock-member-001',
        email: 'demo@vtl-evosystem.com',
        membership_tier: 'mylynx_gold',
        membership_status: 'active',
        entitlements: {
          link3_stage1: false,
          link3_stage2: false,
          link3_stage3: true,
          linxmart_view: true,
          full_evosystem: true,
        },
      },
      _phase: 1,
      _note: 'Mocked response — Phase 2 will replace with real auth',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Production Phase 1: unauthenticated response
  return new Response(JSON.stringify({
    authenticated: false,
    member: null,
    entitlements: {
      link3_stage1: false,
      link3_stage2: false,
      link3_stage3: false,
      linxmart_view: false,
      full_evosystem: false,
    },
    _phase: 1,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}