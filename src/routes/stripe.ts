/**
 * Stripe webhook handler
 * POST /api/v1/stripe/webhook
 *
 * CRITICAL: This endpoint logs Stripe events for audit purposes only
 * VTL holds no fiscal transaction records
 * Stripe webhook secret must be set via: wrangler secret put STRIPE_WEBHOOK_SECRET
 */

import { Env } from '../index';

export async function handleStripeWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify Stripe signature
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get raw body for signature verification
  const rawBody = await request.text();

  // Phase 1: Signature verification skeleton
  // Phase 2: Implement full HMAC-SHA256 verification against STRIPE_WEBHOOK_SECRET
  // For now, log receipt and proceed
  let event: { id: string; type: string; data?: { object?: { customer?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const stripeEventId = event.id;
  const eventType = event.type;
  const customerId = event.data?.object?.customer || null;

  // Check for duplicate event (Stripe can send duplicates)
  const existing = await env.DB.prepare(
    `SELECT id FROM stripe_events WHERE id = ?`
  ).bind(stripeEventId).first();

  if (existing) {
    // Already processed — return 200 to prevent Stripe retrying
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Look up member by Stripe customer ID if available
  let memberId: string | null = null;
  if (customerId) {
    const member = await env.DB.prepare(
      `SELECT id FROM members WHERE stripe_customer_id = ?`
    ).bind(customerId).first();
    memberId = member ? String(member.id) : null;
  }

  // Log the event — audit trail only
  // payload_hash only, not the payload itself
  const payloadHash = await hashPayload(rawBody);

  await env.DB.prepare(`
    INSERT INTO stripe_events
      (id, event_type, stripe_customer_id, member_id, payload_hash, processed, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).bind(
    stripeEventId,
    eventType,
    customerId,
    memberId,
    payloadHash,
    new Date().toISOString()
  ).run();

  // Handle membership status events
  await handleMembershipEvent(env, event, memberId);

  // Mark as processed
  await env.DB.prepare(
    `UPDATE stripe_events SET processed = 1 WHERE id = ?`
  ).bind(stripeEventId).run();

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleMembershipEvent(
  env: Env,
  event: { type: string; data?: { object?: Record<string, unknown> } },
  memberId: string | null
): Promise<void> {
  if (!memberId) return;

  const now = new Date().toISOString();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // Subscription active — update member status
      await env.DB.prepare(`
        UPDATE members
        SET membership_status = 'active', updated_at = ?
        WHERE id = ?
      `).bind(now, memberId).run();
      break;

    case 'customer.subscription.deleted':
      // Subscription cancelled
      await env.DB.prepare(`
        UPDATE members
        SET membership_status = 'cancelled', updated_at = ?
        WHERE id = ?
      `).bind(now, memberId).run();
      break;

    case 'invoice.payment_failed':
      // Payment failed — flag for review
      await env.DB.prepare(`
        UPDATE members
        SET membership_status = 'lapsed', updated_at = ?
        WHERE id = ?
      `).bind(now, memberId).run();
      break;
  }
}

async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
