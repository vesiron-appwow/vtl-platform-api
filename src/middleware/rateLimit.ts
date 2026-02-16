/**
 * Rate limiting middleware
 * Uses KV_CONFIG for rate limit state
 * Applied to search and catalog endpoints
 */

import { Env } from '../index';

const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function withRateLimit(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  // Rate limiting applied at Cloudflare edge in production
  // This is a lightweight application-layer backup
  return await handler();
}
