# Radius — Scale & Expansion (Phase 3 Complete)

A two-sided mobile marketplace connecting customers with verified local service professionals (carpenters, mechanics, tree cutters, landscapers, locksmiths, plumbers, electricians, and appliance repair specialists).

---

## 🚀 Phase 3 Capabilities & Expansion

1. **Multi-City Configuration Engine**:
   - Zero-code market launches: new metropolitan markets are configured via JSON/API (`CityConfig`), including bounding coordinates, service radii, localized currency (`USD`, `CAD`, `GBP`), sales tax rates, fee overrides, and enabled category rosters.
   - GPS coordinate auto-resolution matches mobile users to their nearest supported metro cluster.
2. **Promoted Listings (Sponsored Search Placements)**:
   - Cost-Per-Click (CPC) ad engine enabling verified professionals to purchase top placement within their geographic service radius.
   - **Anti-Displacement Guardrails**: Strict cap of max 1 sponsored card per search, verified-only pro requirement, and radius boundary checks.
   - Impression and click tracking with real-time budget depletion and automated pause on budget exhaustion.
3. **Business Accounts & Portfolio Maintenance**:
   - Built for property managers and corporate facilities with multi-user team roles (`OWNER`, `MANAGER`, `MEMBER`).
   - Recurring routine maintenance job templates (weekly, bi-weekly, monthly, quarterly).
   - Consolidated monthly billing aggregating all fleet bookings into a single invoice.
4. **Lead Credits Marketplace**:
   - Feature-flagged (`ENABLE_LEAD_CREDITS`) pay-per-lead unlocking for high-demand jobs.
   - Credit packages (Starter 10 credits, Growth 25 credits, Pro 50 credits) with idempotent job unlocking.
5. **Radius Shield Damage Protection**:
   - Customer-selectable property damage protection ($9.99 flat fee for up to $10,000 accidental property damage coverage).
   - Integrated claims intake module with photo evidence submission, adjuster review, and administrative claim resolution.
6. **Localization & Internationalization**:
   - Complete tri-lingual support (`en`, `es`, `fr`).
   - Multi-currency (`$`, `CAD`, `£`) and date formatting via standard `Intl` formatters per locale.
7. **Analytics & Cent-to-Cent Financial Reconciliation**:
   - Marketplace conversion funnel: Requests ➔ Matches ➔ Bookings ➔ Completions ➔ Repeat Bookings.
   - Geographic supply liquidity by zone (% matched within 10 km, active pros count).
   - Mathematical cent-to-cent reconciliation verifying gross volume, commissions, fees, taxes, and ad revenue with zero discrepancy.
8. **High-Performance Geospatial Caching & Scale SLA**:
   - Spatial grid quantized cache (~750m resolution, 60s TTL).
   - Verified 10,000-provider load benchmark achieving **p95 latency of 2.01 ms** (SLA target < 500 ms) and **1,376 QPS**.
9. **Comprehensive Security Review (`SECURITY.md`)**:
   - OWASP Top 10 penetration testing checklist, IDOR mitigation, JWT rotation, rate limiting, and zero-runtime-dependency resilience.

---

## 🧪 Automated Test Suite (68 Tests Passing across 16 Suites)

Run the test suite:
```bash
npm test
```

### Test Suites Breakdown:
1. `backend/tests/geospatial-load-benchmark.spec.ts`: 10,000-provider scale benchmark asserting p95 < 500 ms (**Passed: 2.01 ms p95**).
2. `backend/tests/multi-city.spec.ts`: Zero-code market launch (Miami & London) with localized taxes, currencies, and category gating.
3. `backend/tests/promoted-listings.spec.ts`: Sponsored search placements, CPC click ledger, and anti-displacement guardrails.
4. `backend/tests/business-accounts.spec.ts`: Corporate fleet accounts, recurring templates, and consolidated monthly invoices.
5. `backend/tests/lead-credits.spec.ts`: Feature-flagged credit purchases, balances, and idempotent job request unlocks.
6. `backend/tests/insurance-claims.spec.ts`: Damage protection plan, claim intake with photos, and admin resolution.
7. `backend/tests/analytics-reconciliation.spec.ts`: Funnel analysis, supply liquidity, and exact cent-to-cent financial reconciliation.
8. `backend/tests/quotes-lifecycle.spec.ts`: Competitive quoting, atomic acceptance, and race-condition safety.
9. `backend/tests/subscriptions-webhooks.spec.ts`: Stripe Billing webhook idempotency, Pro Plus discounts, and Radius Plus fee waivers.
10. `backend/tests/realtime-chat.spec.ts`: WebSocket chat hub with zero-loss reconnection synchronization.
11. `backend/tests/ratings-antispam.spec.ts`: Anti-collusion rating aggregation excluding repetitive account pair spam.
12. `backend/tests/escrow-flow.spec.ts`: Stripe manual capture escrow hold, 72h auto-confirmation, and dispute holds.
13. `backend/tests/geospatial.spec.ts`: WGS84 geodesic calculations, ST_DWithin filters, and ~750m zone masking.
14. `backend/tests/pricing.spec.ts`: Single source-of-truth pricing, urgent dispatch surcharges, and fee overrides.
15. `backend/tests/privacy-auth.spec.ts`: Brute-force OTP protection and pre-confirmation contact detail concealment.
16. `backend/tests/state-machine.spec.ts`: Centralized booking state machine enforcing legal state transitions.

---

## 📊 10,000-Provider Load Test Benchmark Results

```
--- 10,000-PROVIDER GEOSPATIAL LOAD TEST BENCHMARK REPORT ---
Target Providers Seeded: 10,000
Queries Executed:       1,000
Throughput:             1,376 QPS
Min Latency:            0.00 ms
Avg Latency:            0.72 ms
p50 (Median) Latency:   0.47 ms
p90 Latency:            1.52 ms
p95 Latency:            2.01 ms  <--- SLA Target: < 500 ms (PASSED)
p99 Latency:            3.38 ms
Cache Hits / Misses:    194 / 806
------------------------------------------------------------
```

---

## 📋 Launch-Readiness Checklist

- [x] **Multi-City Configuration**: Declarative config allows launching new cities without code changes.
- [x] **Geospatial Query SLA**: Verified p95 latency under 500 ms at 10,000 provider scale (achieved 2.01 ms).
- [x] **Financial Reconciliation**: Live audit verifies GMV, payouts, fees, taxes, and ad spend to the penny.
- [x] **Escrow & Manual Capture**: Stripe manual capture holds customer funds until verified completion.
- [x] **Privacy & Address Protection**: Customer address and phone hidden until booking confirmation.
- [x] **Anti-Collusion Rating Defense**: Circular review farming between account pairs is detected and neutralized.
- [x] **Dispute Resolution with 48h SLA**: Structured reasons, evidence uploads, and breach alert countdown timers.
- [x] **Sponsored Search Guardrails**: Capped at 1 slot; requires verified status and within-radius location.
- [x] **Localization Ready**: English, Spanish, and French with locale-specific currency and date formatting.
- [x] **Security Hardened**: Documented in `SECURITY.md` covering OWASP vectors and secrets rotation.
- [x] **Docker Infrastructure**: Ready for containerized deployment via `infra/docker-compose.yml`.
