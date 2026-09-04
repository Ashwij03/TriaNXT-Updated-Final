# billing — real, payable subscription system

The org-level subscription/billing model: a plan catalog (`PlanTier`), one
`Subscription` per `Organization`, an append-only `SubscriptionEvent` audit
trail, and a `PaymentTransaction` ledger fed only by server-side verified
gateway responses (Razorpay).

## Decisions made (and the product questions they resolve)

### 1. Free tier on signup: YES, a price-0 default tier auto-activates

The product question ("PENDING_PAYMENT vs an active free default tier on
signup") is resolved as: **a default `Free` tier (price 0) is lazily
activated as `ACTIVE` with no end date the first time an organization is
seen.** Migration `0002_seed_default_plan_tier` seeds it on every install.

Rationale: the existing product already gives away free trial days through
referrals (`licensing`), and enforcement rules require `status == Active`
for study creation and user approval — a brand-new org stuck in
PENDING_PAYMENT would be dead on arrival. The behavior is **data-driven,
not hard-coded**: `get_or_create_subscription()` activates the default tier
when its `price == 0`, otherwise leaves the org in `PENDING_PAYMENT`. If
product later wants a paid-only funnel, set the default tier's price > 0 —
no code change needed.

### 2. Status is recomputed on read, never trusted stale

`Subscription.recompute_status()` / `is_usable()` return `EXPIRED` the
moment an `ACTIVE` row's `end_date` passes — same "computed on read" stance
as `licensing.LicenseEntitlement.is_referral_license_active()`. The stored
`status` column is a snapshot written by the last transition; guards never
wait for the settle job to persist it. The `/subscription/me` payload and
every guard therefore reflect reality even between settle ticks.

### 3. Wire format is camelCase, aliased per-field

No camelCase renderer exists in this project's DRF config, and adding one
would silently re-shape every other app's responses — so `billing`'s
serializers emit the frontend's camelCase keys via explicit `source=`
aliases (`maxStudies`, `planId`, `startDate`, ...). DB columns stay
snake_case. This makes the API a drop-in replacement for the frontend's
localStorage `planCatalog` / `trianxtSubscription` objects with no
client-side shape translation.

Two contract notes for the swap-over:

- `plan` is the **denormalized tier name string** (matching
  `subscriptionService.js`); the full tier object is additionally available
  under `planDetails` (features, limits, price) so the UI needs no second
  lookup.
- Numeric limits use **`UNLIMITED_LIMIT = -1` as the wire sentinel** for
  "unlimited" (DB stores NULL). `UNLIMITED_LIMIT` in
  `billing/models.py` must stay equal to `planCatalogService.js`'s
  constant — it is the single number to reconcile if the frontend ever
  changes it.

### 4. "Admin only" = Admin role of the subscription's own org

Existing backend Admin endpoints gate on `request.user.is_superuser`;
`monitoring` introduced role-name helpers because org roles are free text.
`billing` follows the stronger of the two: subscription actions require the
caller to be an **Admin of the SAME org the subscription belongs to**
(`billing/permissions.py::is_org_admin`), with superuser bypass retained.
Plan-tier CRUD is gated by `can_manage_plan_catalog()` — superuser OR an
org Admin — because `SubscriptionManagement.js`'s PlanFormModal lives
behind the org Admin screen in today's single-org deployment. **If the
product ever goes truly multi-tenant, plan CRUD should move behind a
platform-admins table; the endpoints funnel through one function so the
change is a one-liner.**

### 5. Billing period is monthly (30 days)

Plan tiers carry no period field (the frontend schema has none), so paid
periods are `BILLING_DEFAULT_PERIOD_DAYS` (default 30, env-overridable).
End-date math stacks from the later of today / the existing future end date
— the port of `licensing.services.compute_stacked_end_date`.

### 6. Cancel = at the end of the paid period

`cancel_subscription` on an active subscription switches auto-renewal off
and leaves access until `end_date` (settle-on-login then persists EXPIRED);
only a never-activated PENDING_PAYMENT row is cancelled outright. This
avoids locking paying orgs out of windows they already paid for.

### 7. Auto-renewal charge: hook is in, real card/token charging is NOT

`settle_subscription_on_login()` is implemented as the login hook (no
Celery exists in this codebase — flagged per the task; a periodic job can
later call the same function per org). When auto-renewal is on and the
window lapses it calls `attempt_auto_renewal()`, which currently records
*why* no charge was possible (`payment_failed` audit event) and lets the
subscription expire. A real recurring charge needs a stored payment
instrument (Razorpay saved card/token or a recurring-subscription
agreement) — **that token vault does not exist yet and is the one
infrastructure piece this MVP deliberately leaves out.** The charge call
slots into `attempt_auto_renewal()` the moment it exists.

## Enforcement wiring (server-side, non-bypassable)

`can_create_study()` / `can_approve_user()` (and their `assert_*` raising
variants) are ports of `subscriptionGuard.js`, evaluated against the
recomputed status + effective limits + live counts.

- **`can_approve_user` IS wired into the one real capacity-changing path
  that exists in this backend**: user registration into an existing org
  (`accounts/views.py::RegisterAPI`) — the server-side analogue of an admin
  approving a user onto the org. The org's first user (founder bootstrap)
  is exempt.
- **`can_create_study` has no call site yet because no Study model or
  study-creation service exists anywhere in this backend** (audited at
  implementation time; `subscriptions` app hits the same wall). The future
  `studies/services.py::create_study()` should call
  `assert_can_create_study(organization)` as its first line, exactly as the
  frontend calls `assertCanCreateStudy()` first — the function is
  import-ready and its message contract matches the frontend's wording.
  Usage counting already handles the missing model (`organization.studies`
  fails soft to 0 and the real one-liner slots in when the model lands).

`settle_subscription_on_login()` is wired into `accounts/views.py::LoginAPI`
after a successful session login; it fails soft by contract.

## Razorpay integration

- SDK pinned in `requirements/base.txt` (`razorpay`); keys come from the
  environment or a root `.env` (see `.env.example`) via the python-dotenv
  load added in `settings.py`.
- Only `RAZORPAY_KEY_ID` (publishable) is ever returned to the frontend —
  in `initiate_checkout`'s payload. `KEY_SECRET` / `WEBHOOK_SECRET` never
  leave `gateway.py` / settings.
- Order creation and payment capture go through the official SDK; payment
  callback and webhook signatures are verified with the SDK's own HMAC
  verifiers over the raw body — nothing client-asserted is trusted.
- The webhook endpoint is the **source of truth**: it can activate a
  subscription even if the user closes the tab before the client confirm
  call fires, it is idempotent (dedupe on the payment row; already-CAPTURED
  deliveries are no-ops), and it returns 200 quickly.
- Webhook events currently handled: `payment.authorized`, `payment.captured`
  (activate) and `payment.failed` / `payment.pending` / `payment.declined`
  (record failure). Amount/currency mismatches never activate. Other events
  (`order.paid`, refunds, ...) are acknowledged and ignored.

## Layout

```
models.py       PlanTier / Subscription / SubscriptionEvent / PaymentTransaction
services.py     all business rules; atomic + select_for_update on races
gateway.py      razorpay SDK adapter (the only module that touches the gateway)
permissions.py  role helpers (org Admin, plan-catalog admin)
serializers.py  camelCase wire contract (+ validation mirroring PlanFormModal)
views.py        endpoints per the API table below; no business logic
tests.py        42 tests: idempotency, signatures, guards, races
```

### Endpoints (mounted at `/api/billing/`)

| Endpoint | Methods | Permission |
|---|---|---|
| `/api/billing/plans/` | GET | any authenticated role (catalog) |
| `/api/billing/plans/` | POST | Admin (create tier) |
| `/api/billing/plans/<id>/` | PUT/PATCH | Admin (edit tier) |
| `/api/billing/plans/<id>/` | DELETE | Admin (soft-deactivate; 409 when default / in use / last plan) |
| `/api/billing/subscription/me/` | GET | any authenticated role (their org's subscription) |
| `/api/billing/subscription/checkout/` | POST | org Admin |
| `/api/billing/subscription/confirm/` | POST | org Admin |
| `/api/billing/subscription/assign/` | POST | org Admin (no-payment plan switch) |
| `/api/billing/subscription/cancel/` | POST | org Admin |
| `/api/billing/subscription/auto-renewal/` | PATCH | org Admin |
| `/api/billing/webhooks/razorpay/` | POST | **no auth** — signature header, CSRF-exempt |

## Scope note (why not `subscriptions` / `licensing`)

`billing` deliberately does not touch `licensing` (referral days + the
per-user `subscription_end_date`) and sits apart from the parallel
display-only `subscriptions` catalog task in this workspace: **this app is
the real, payable system** (gateway orders, verified webhooks, race-safe
capture, audit events, server-side enforcement). `licensing`'s
`subscription_end_date` remains untouched. If/when `subscriptions` and
`billing` are reconciled, `billing` is the payer-of-record: its
`Subscription` row is what enforcement and Admin screens should read.
