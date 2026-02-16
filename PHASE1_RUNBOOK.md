# VTL Evosystem — Phase 1 Infrastructure Deployment Runbook
# Platform Interface Specification V1
# Execute every step in order. Do not skip steps. Do not proceed to Phase 2 until all acceptance gates pass.

---

## PREREQUISITES

- Cloudflare account active
- Wrangler CLI installed: `npm install -g wrangler`
- Wrangler authenticated: `wrangler login`
- Node.js 18+ installed
- Stripe account active (for webhook configuration)

---

## STEP 1 — Install dependencies

```bash
cd vtl-platform-api
npm ci
```

Expected: clean install, no errors.

---

## STEP 2 — Create D1 Database

```bash
wrangler d1 create vtl-evosystem
```

Copy the `database_id` from the output.
Open `wrangler.toml` and replace `REPLACE_WITH_D1_DATABASE_ID` with the actual ID.

---

## STEP 3 — Apply D1 Schema

```bash
# Apply to remote (production)
npm run db:schema:remote

# Apply to local (development)
npm run db:schema:local
```

Expected output: all CREATE TABLE statements execute without error.
Verify: `wrangler d1 execute vtl-evosystem --command="SELECT name FROM sqlite_master WHERE type='table'"`

Expected tables:
- members
- businesses
- vehicles
- properties
- menus
- apps_catalog
- app_verifications
- developer_submissions
- link3_items
- mylynx_gold_offers
- stripe_events

---

## STEP 4 — Create KV Namespaces

```bash
# KV_CATALOG — app catalogue listings and search cache
wrangler kv namespace create KV_CATALOG
wrangler kv namespace create KV_CATALOG --preview

# KV_CONFIG — configuration, feature flags, session data
wrangler kv namespace create KV_CONFIG
wrangler kv namespace create KV_CONFIG --preview
```

Copy the `id` values from each output.
Update `wrangler.toml`:
- `KV_CATALOG` id and preview_id
- `KV_CONFIG` id and preview_id

---

## STEP 5 — Create R2 Buckets

```bash
# R2_MEDIA — app icons, screenshots, Trade IA media assets
wrangler r2 bucket create vtl-media

# R2_DOCS — developer documentation, guides, R2-hosted content
wrangler r2 bucket create vtl-docs
```

Binding names in wrangler.toml are already set: `R2_MEDIA` and `R2_DOCS`.
Bucket names must be: `vtl-media` and `vtl-docs`.

---

## STEP 6 — Set Secrets

Never put secrets in wrangler.toml or any committed file.

```bash
# Stripe secret key (from Stripe Dashboard → Developers → API Keys)
wrangler secret put STRIPE_SECRET_KEY

# Stripe webhook secret (created in Step 8 below)
# Run this after Step 8
wrangler secret put STRIPE_WEBHOOK_SECRET
```

---

## STEP 7 — Deploy Worker

```bash
npm run deploy
```

Expected: Worker deployed successfully.
Note the worker URL: `https://vtl-platform-api.{account}.workers.dev`

---

## STEP 8 — Configure Stripe Webhook

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- Endpoint URL: `https://vtl-platform-api.{account}.workers.dev/api/v1/stripe/webhook`
- Events to listen for:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`

Copy the Webhook Signing Secret and run:
```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
```

---

## STEP 9 — Configure Cloudflare Access

In Cloudflare Zero Trust Dashboard → Access → Applications:

Create Application 1 — Developer Portal:
- Name: VTL Developer Portal
- Path: `/api/v1/submissions/*`
- Policy: Require email domain OR one-time PIN
- Note: This protects the submission endpoint in Phase 2

Create Application 2 — Admin Dashboard:
- Name: VTL Admin
- Path: `/api/v1/admin/*`
- Policy: Specific email addresses only (VTL team)

Phase 1 note: Access is configured but not enforced on members/me endpoint yet.
Phase 2: JWT validation added to members.ts handler.

---

## ACCEPTANCE GATES — All must pass before Phase 2 begins

### Gate 1 — Health check passes

```bash
curl https://vtl-platform-api.{account}.workers.dev/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "bindings": {
    "DB": "connected",
    "KV_CATALOG": "connected",
    "KV_CONFIG": "connected",
    "R2_MEDIA": "connected",
    "R2_DOCS": "connected"
  }
}
```

All bindings must show `connected`. Any `missing` = Phase 1 not complete.

### Gate 2 — Schema verified

```bash
wrangler d1 execute vtl-evosystem --command="SELECT count(*) as table_count FROM sqlite_master WHERE type='table'"
```

Expected: `table_count` = 11

### Gate 3 — Catalog endpoint responds

```bash
curl https://vtl-platform-api.{account}.workers.dev/api/v1/catalog/apps
```

Expected: `{ "apps": [], "count": 0, "source": "d1" }` — empty but valid response.

### Gate 4 — Members/me responds with correct shape

```bash
curl https://vtl-platform-api.{account}.workers.dev/api/v1/members/me
```

Expected: JSON with `authenticated`, `member`, `entitlements` fields present — shape is canonical for all IAs.

### Gate 5 — Stripe webhook receives without error

Send a test event from Stripe Dashboard → Webhooks → Send test event.
Check stripe_events table:
```bash
wrangler d1 execute vtl-evosystem --command="SELECT count(*) FROM stripe_events"
```

Expected: count increases by 1.

---

## PHASE 1 COMPLETE

When all five gates pass, Phase 1 is declared complete.
Record the following for Phase 2:

- Worker URL: _______________
- D1 Database ID: _______________
- KV_CATALOG ID: _______________
- KV_CONFIG ID: _______________
- R2_MEDIA bucket: vtl-media
- R2_DOCS bucket: vtl-docs

Phase 2 begins: AppWow Astro build.
PUBLIC_VTL_API_BASE for AppWow Pages project = Worker URL above.
