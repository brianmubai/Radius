# Radius Security Policy, Penetration Testing Checklist & Secrets Rotation

## 1. Overview
Radius is a mission-critical two-sided marketplace handling sensitive identity documents, customer physical addresses, payments in escrow, and live messaging. Security is baked into the architecture from the database schema up through the mobile and admin frontends.

---

## 2. Penetration Testing Checklist (OWASP Top 10 + Marketplace Vectors)

### 2.1 Authentication & Session Management
- [x] **OTP Brute-Force Protection**: Max 5 attempts per OTP code before lockout with exponential backoff.
- [x] **Salted & Hashed Secrets**: Passwords and OTP codes are hashed via crypto hashes (`sha256` / `scrypt`).
- [x] **JWT Expiration & Refresh Rotation**:
  - Access Token: 15 minutes lifetime (`exp`).
  - Refresh Token: 7 days lifetime with database revokable session tokens.
- [x] **Role-Based Access Control (RBAC)**: Strict separation of `REQUESTER`, `PROVIDER`, and `ADMIN` endpoints.

### 2.2 Data Privacy & Inadvertent Contact Leakage
- [x] **Pre-Confirmation Privacy Masking**: Customer phone and email are strictly hidden until booking is confirmed (`BOOKED`).
- [x] **Geospatial Location Masking**: Provider real-time GPS coordinates are truncated to a ~750m grid centroid prior to booking confirmation.
- [x] **Exact Job Address Protection**: Job physical addresses are concealed from general search and revealed exclusively to the confirmed provider.

### 2.3 Injection & Database Security
- [x] **PostGIS ST_DWithin Parametrization**: All geospatial queries use parametrized geography point arguments and GiST index lookups (`geom <-> point`).
- [x] **SQL Injection Defense**: Prisma/Drizzle ORM parametrization prevents SQL injection vectors across all dynamic filters.
- [x] **Input Validation**: Server-side payload schemas validate string length, coordinates bounds (-90 to +90, -180 to +180), and non-negative monetary amounts.

### 2.4 Escrow, Payments & Fraud Prevention
- [x] **Centralized Booking State Machine**: Transitions are enforced in a single state machine service; illegal jumps (e.g. `REQUESTED -> PAID_OUT`) throw errors.
- [x] **Idempotent Webhook Processing**: Stripe billing and payment webhooks verify event signatures and deduplicate events via unique event ID sets.
- [x] **Anti-Collusion Rating Guardrails**: Review aggregation detects and excludes repeated reviews between identical account pairs to neutralize review farming.
- [x] **Ad Auction Guardrails**: Promoted listings enforce a strict limit of max 1 sponsored card per search, verified-only qualification, and geographic radius constraints.

### 2.5 Object Storage & File Security
- [x] **Signed Short-Lived URLs**: ID verification licenses and damage evidence photos are kept in private S3 buckets and accessed via presigned URLs with 15-minute expirations.
- [x] **Direct Upload Sanitization**: Files uploaded to storage are validated for MIME type (`image/jpeg`, `image/png`, `application/pdf`) and size caps (10 MB).

---

## 3. Dependency Audit & Vulnerability Remediation Procedure

### 3.1 Automated Scanning
1. **Daily CI Audit**:
   ```bash
   npm audit --audit-level=high
   ```
2. **Dependabot / Renovate**: Configured to generate automated security pull requests on high or critical CVE advisories.

### 3.2 Vulnerability Triage Matrix
| Severity | SLA for Remediation | Action |
| :--- | :--- | :--- |
| **Critical** | < 24 Hours | Patch immediately or apply temporary network/WAF bypass rule; deploy hotfix. |
| **High** | < 72 Hours | Bump package minor/patch version, run full test suite, verify regression. |
| **Medium** | < 14 Days | Scheduled dependency upgrade during sprint cycle. |
| **Low** | < 30 Days | Routine maintenance upgrade. |

### 3.3 Offline Runtime Resilience
The Radius backend is engineered with zero runtime external package dependencies (`node:http`, `node:crypto`, `node:test`, `node:perf_hooks`), eliminating supply-chain package hijacking risks for core transactional operations.

---

## 4. Secrets Rotation Procedure

### 4.1 Secret Inventory
1. `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
2. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
3. `POSTGRES_PASSWORD`
4. `S3_ACCESS_KEY` / `S3_SECRET_KEY`

### 4.2 Dual-Key Rotation Procedures

#### A. JWT Secret Key Rotation (Zero Downtime)
1. **Step 1**: Generate a new 256-bit secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Step 2**: Set environment variables with dual-key support:
   - `JWT_ACCESS_SECRET_PRIMARY=<new_secret>`
   - `JWT_ACCESS_SECRET_FALLBACK=<old_secret>`
3. **Step 3**: The verification service signs new tokens with `PRIMARY` while validating incoming tokens against `PRIMARY` then `FALLBACK`.
4. **Step 4**: After 15 minutes (access token TTL), retire `FALLBACK`.

#### B. Stripe Webhook Secret Rotation
1. **Step 1**: In the Stripe Dashboard, navigate to **Developers > Webhooks > Add Secret**.
2. **Step 2**: Add the new webhook secret to backend environment configuration:
   - `STRIPE_WEBHOOK_SECRET_NEW=<new_secret>`
3. **Step 3**: Verify webhook signatures using both secrets until the old secret is rolled out.
4. **Step 4**: Delete the legacy secret in Stripe Dashboard.

#### C. PostgreSQL Database Password Rotation
1. **Step 1**: Create a secondary PostgreSQL user with identical database permissions:
   ```sql
   CREATE USER radius_app_v2 WITH PASSWORD '<new_password>';
   GRANT radius_role TO radius_app_v2;
   ```
2. **Step 2**: Update backend database connection strings across cluster instances.
3. **Step 3**: Terminate legacy active connections and revoke previous user:
   ```sql
   REVOKE CONNECT ON DATABASE radius FROM radius_app_v1;
   DROP USER radius_app_v1;
   ```

---

## 5. Security Incident Response
To report a security vulnerability or security incident, email `security@radius-market.com`. We support encrypted communication via PGP key `0xRADIUS_SEC`.
