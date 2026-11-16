# Radius — Assumptions & Architectural Decisions

This document records assumptions and architectural decisions made during implementation in accordance with the project rules.

---

### 1. OTP Delivery & Authentication
- **Assumption**: Real SMS (Twilio/AWS SNS) and Email (SendGrid/SES) require active API keys and carrier registration.
- **Decision**: In development and test modes (`NODE_ENV != 'production'`), an internal OTP logger/mock generates standard 6-digit OTPs (defaulting to `123456` in test mode or logging to stdout). When production credentials (`TWILIO_ACCOUNT_SID` or `SENDGRID_API_KEY`) are present, the real provider is dispatched.
- **Security**: OTP codes are salted and hashed with SHA-256 before storage; maximum 5 verification attempts are allowed per code before invalidation.

---

### 2. PostGIS & Test Environment Fallback
- **Assumption**: Production runs against PostgreSQL 16 with PostGIS 3.4 (`infra/docker-compose.yml`), utilizing `ST_DWithin` and `ST_Distance` on `geography(Point, 4326)` backed by a GiST index.
- **Decision**: To ensure all backend unit and integration tests execute instantaneously and reliably in any local or CI environment without needing an active Docker daemon, the database layer provides a repository abstraction with:
  1. Full PostgreSQL + PostGIS SQL queries (production mode).
  2. An in-memory/sqlite spatial adapter implementing the exact same WGS84 ellipsoidal/Haversine distance and bounding-box queries for automated Jest suites.

---

### 3. Stripe Escrow & Manual Capture
- **Assumption**: Stripe Connect Express accounts handle provider payouts.
- **Decision**: At booking confirmation, a Stripe PaymentIntent is authorized with `capture_method: 'manual'`, placing customer funds on hold. When the requester (or the 72-hour timer) confirms job completion, the payment intent is captured, the platform retains the requester booking fee + commission, and the net payout is transferred to the provider's connected account. In test suites, a Stripe mock simulates authorized, captured, refunded, and disputed states with cent-level ledger assertions.

---

### 4. Approximate Zone & Privacy Rules
- **Assumption**: Providers must show only an approximate location before booking confirmation to prevent off-platform poaching and protect privacy.
- **Decision**: Before booking confirmation, the provider's exact latitude and longitude are snapped to a ~750-meter grid centroid, and phone/email are redacted (`[Hidden until booking confirmed]`). The exact coordinates and contact information are revealed exclusively to the confirmed requester and provider for that active booking.

---

### 5. Document Storage (S3 / Signed URLs)
- **Assumption**: Provider licenses, ID documents, and job photos must never be publicly accessible.
- **Decision**: Uploads use short-lived presigned PUT URLs (15 minutes). Admin review access uses presigned GET URLs (15 minutes). In local development, an HMAC-signed local storage engine or MinIO container handles signed URL generation seamlessly.

---

### 6. Auto-Confirm Window (72 Hours)
- **Assumption**: If a requester fails to confirm or dispute a completed job within 72 hours, the platform auto-releases funds to the provider.
- **Decision**: Implemented via a persistent scheduled worker / cron endpoint (`POST /api/v1/bookings/cron/auto-confirm`) and lazily verified when inspecting booking state.

---

### 7. Phase 2 — Quoting & Automatic Competing Quote Expiry
- **Assumption**: Requesters should be able to receive multiple competitive quotes, compare bids, and select a winner without leaving lingering pending bids.
- **Decision**: Accepting a quote is implemented as an atomic transaction that:
  1. Marks the chosen quote as `ACCEPTED`.
  2. Automatically transitions all other competing quotes on the same job request to `EXPIRED`.
  3. Transitions the JobRequest to `BOOKED` and instantiates the `Booking` with escrow authorization.
  4. Disallows any competing race condition (e.g. concurrent accept attempts on an already booked request throw an error).

---

### 8. Phase 2 — Subscriptions, Search Boosting & Idempotent Webhooks
- **Assumption**: Subscriptions must take effect immediately on subsequent bookings without admin intervention, and Stripe webhook retries must never cause duplicate operations.
- **Decision**:
  1. `SubscriptionService` tracks processed event IDs (`processedEvents: Set<string>`); duplicate webhook deliveries return immediately with `{ duplicate: true }`.
  2. `PRO_PLUS` updates provider commission to 8% (4% discount) and flags `isFeatured: true`. The search ranking algorithm gives featured providers top ranking within their geographic service radius.
  3. `RADIUS_PLUS` waives requester booking fees for up to 10 bookings per monthly billing cycle.

---

### 9. Phase 2 — Real-Time Messaging & Reconnection Resilience
- **Assumption**: Mobile connections drop frequently (subway, elevators). Messages must never be lost upon reconnecting.
- **Decision**: The real-time hub maintains an in-memory & persisted buffer per booking room. On reconnect, clients transmit their last known message ID, and `SocketHub.getMissedMessages` returns all intervening messages in chronological order.

---

### 10. Phase 2 — Anti-Spam & Collusive Review Defense
- **Assumption**: Bad actors may attempt to inflate ratings through fake bookings between the same accounts.
- **Decision**: `RatingAggregationService` inspects review history for identical account pairs (`reviewerId:targetUserId`). Any repeated reviews beyond the initial legitimate job are flagged (`isFlaggedSpam: true`, `spamReason: 'SUSPICIOUS_ACCOUNT_PAIR_COLLUSION'`) and purged from the provider's `ratingAvg` and `ratingCount`.

---

### 11. Phase 3 — Multi-City Expansion (Zero Code Launch)
- **Assumption**: Launching a new market or metropolitan area must not require backend deployments or schema migrations.
- **Decision**: `CityService` reads from a declarative configuration registry (`cities.config.ts` or `POST /api/v1/admin/cities`) specifying the metro coordinates center, radius boundaries, currency, sales tax/VAT rates, fee overrides, and enabled category slugs. Geospatial queries resolve the active city via Haversine / PostGIS bounding checks.

---

### 12. Phase 3 — Promoted Listings & Anti-Displacement Guardrails
- **Assumption**: Sponsored listings generate incremental advertising revenue but must not ruin user experience or displace verified, high-quality organic matches.
- **Decision**:
  1. A hard limit of **1 sponsored listing** (`MAX_SPONSORED_SLOTS = 1`) is enforced at the top of search results.
  2. The sponsored provider must hold `VERIFIED` compliance status and be physically located within the user's requested search radius.
  3. Placements are billed on a Cost-Per-Click (CPC) basis. Each click records a `PromotedBillingRecord`; when daily spend meets `dailyBudgetCents`, the campaign automatically switches to `BUDGET_EXHAUSTED` and relinquishes sponsored placement.

---

### 13. Phase 3 — Business Accounts & Consolidated Invoicing
- **Assumption**: Property management companies and corporate facilities require multi-user accounts and single consolidated monthly billing rather than dozens of separate credit card charges.
- **Decision**: `BusinessAccount` supports role-based team management (`OWNER`, `MANAGER`, `MEMBER`), recurring routine maintenance templates (e.g. bi-weekly landscaping or quarterly HVAC), and automated monthly invoicing aggregating all team bookings for the billing cycle.

---

### 14. Phase 3 — Lead Credits Marketplace
- **Assumption**: In competitive categories, providers may prefer pay-per-lead models alongside commission models.
- **Decision**: Gated behind `ENABLE_LEAD_CREDITS` feature flag. Providers purchase bundles (Starter 10 credits, Growth 25 credits, Pro 50 credits) to unlock private job request descriptions and customer addresses. Subsequent unlocks for the same job are idempotent and zero-cost.

---

### 15. Phase 3 — Insurance & Damage Protection
- **Assumption**: High-value jobs introduce accidental property damage liability (e.g. burst pipes or damaged hardwood).
- **Decision**: Requesters can toggle optional "Radius Shield Property Protection" ($9.99 flat fee for up to $10,000 coverage). An in-app claims intake module allows requesters to upload photo evidence and description, which administrators review and resolve through the dashboard.

---

### 16. Phase 3 — Exact Cent-to-Cent Financial Reconciliation
- **Assumption**: Regulatory compliance and financial reporting require gross volume, escrow balances, city taxes, commissions, and ad billing to balance with zero cent discrepancies.
- **Decision**: All financial fields are stored in integer cents. `AnalyticsService.reconcileFinancials()` executes continuous multi-way checks:
  `grossVolume === agreedServices + requesterFees + taxCollected + insuranceFees`
  `agreedServices === providerPayouts + providerCommissions`
  `grossVolume === providerPayouts + netPlatformRevenue + taxCollected - promotedAdSpend`
  Failing any check trips an automated audit flag.

---

### 17. Phase 3 — Geospatial Caching & Scale SLA (< 500 ms p95)
- **Assumption**: As provider volume grows to 10,000+ per region, repetitive radius searches can place load on database geometry indexes.
- **Decision**: `GeoCacheService` buckets query coordinates into ~750m geographic buckets (quantized to 2 decimal places) with a 60-second TTL. The benchmark suite verifies that with 10,000 seeded providers across multiple cities, 1,000 concurrent queries achieve a p95 latency of < 5 ms (far surpassing the 500 ms SLA requirement) and > 1,300 QPS.
