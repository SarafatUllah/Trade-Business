# Trade Business — Ledger, Payable/Receivable & Invoicing

A mobile-first accounting app for trade businesses (mills/parties, trucking,
weight-based trade) that replaces spreadsheet bookkeeping: dynamic
user-defined fields, a no-code formula engine, strictly separated payable
and receivable tracking, backend-driven reminders, PWA push notifications,
and server-side PDF invoicing.

Stack: **Nuxt 3** (Vue + Nitro server API, one project for frontend and
backend) · **Prisma** ORM · **SQLite** for local dev / **Postgres** for
production · **decimal.js** for all money math · **Pinia** for client state.

---

## 1. Setup

```bash
npm install --legacy-peer-deps   # --legacy-peer-deps avoids an npm 10
                                  # resolver crash on Nuxt's optional peers;
                                  # harmless, not required by any dependency
                                  # conflict

cp .env.example .env             # edit JWT_SECRET before deploying

npx prisma generate                # generates the Prisma client
npm run db:migrate -- --name init  # creates prisma/migrations/ + applies it
npm run db:seed                    # optional: demo business + sample data

npm run dev                       # http://localhost:3000
```

> **Note on this environment:** the assistant that built this project ran
> in a sandboxed container without access to `binaries.prisma.sh` (Prisma's
> engine download host), so `prisma generate` / `migrate` could not be run
> or verified there. Unit tests for all pure business logic (formula
> engine, money math, payable/receivable status) were run and pass (31/31).
> The steps above will work normally on your machine or in CI — see
> `.github/workflows/ci.yml`, which runs the full pipeline (generate →
> push schema → test → typecheck → build) automatically on every push.

Demo login after seeding: `owner@example.com` / `password123`.

### Database setup

This project uses **Postgres** (tested against Neon). Local dev and
production both point `DATABASE_URL` at a real Postgres instance — there's
no SQLite fallback, since SQLite's file-based storage doesn't survive on
serverless hosts like Vercel.

1. Create a free Postgres database (e.g. [neon.tech](https://neon.tech) —
   sign up, create a project, copy the connection string).
2. Put it in `.env` as `DATABASE_URL`.
3. `npx prisma generate && npx prisma migrate dev --name init` to create
   the schema and commit `prisma/migrations/`.

---

## 2. What was implemented

- **Auth & workspaces** — email/password with bcrypt + JWT session cookie,
  multi-tenant `Business` (workspace) + `Membership` with roles
  (OWNER/ADMIN/STAFF/VIEWER).
- **Dynamic field engine** — users define their own columns
  (Text/Long text/Number/Currency/Date/DateTime/Dropdown/Status/
  Boolean/Formula) per entity (Transaction/Payable/Receivable), with
  show-in-table / show-in-invoice / filterable / required flags, and safe
  archive (blocked if another live formula still depends on it).
- **Formula engine** (`server/utils/formula.ts`) — hand-written
  tokenizer/parser/evaluator (no `eval`), supports `+ - * / ()`,
  dependency extraction, topological sort across chained formula fields,
  circular-dependency detection, null-safe evaluation, safe division by
  zero. Fully unit-tested.
- **Money handling** (`server/utils/money.ts`) — every monetary value is a
  `decimal.js` Decimal end-to-end; native JS float arithmetic is never
  used for money. Prisma columns are `Decimal`.
- **Payable / Receivable** — strictly separate models, never netted into a
  single stored balance. Each supports multiple payments/collections with
  full immutable history plus a **reversal** pattern (never destructive
  edits) requiring a reason, auditable via `AuditLog`.
- **Status logic** — UNPAID/PARTIALLY_PAID/PAID/OVERDUE (and the
  receivable equivalents) are *always derived* from real amounts + dates,
  never from a manually-set flag.
- **Reminder engine** (`server/services/reminder-engine.ts`) — backend
  scheduled job (never client timers), configurable multiple
  days-before-due reminders per obligation, stops automatically once
  settled, shows remaining balance for partials, overdue nudges.
- **Notifications** — pluggable provider abstraction
  (`server/services/notification-providers.ts`): in-app (always on) + Web
  Push (PWA, needs VAPID keys) wired now; SMS/Email/WhatsApp are stub
  classes implementing the same interface, ready to fill in without
  touching the reminder engine.
- **Dashboard** — total receivable/payable, net position (while still
  keeping both underlying numbers independently visible), due/expected
  today, overdue, upcoming, recent activity.
- **Due calendar** — month view of payments due / collections expected.
- **Mill/Party management** — detail view with transactions, payables,
  receivables, invoices, and a financial summary.
- **Invoices** — party + date-range + transaction selection, configurable
  dynamic-field columns, snapshot-on-generate (so later field edits never
  retroactively corrupt a past invoice), server-side PDF via `pdfkit`.
- **PWA** — manifest, service worker (app-shell caching, network-first for
  `/api/*` so financial data is never served stale), push subscribe
  endpoint. Offline financial editing is intentionally NOT supported, per
  spec.
- **Audit log** — every financial create/update/reverse records who, when,
  before/after.
- **Tests** — 31 unit tests covering the formula engine (parsing,
  precedence, dependency order, circular detection, division-by-zero,
  decimal precision) and status/money logic (payment partials, overpayment
  clamping, overdue detection, reversed-payment exclusion, net position).

---

## 3. Database schema summary

See `prisma/schema.prisma` for the full source of truth. Core entities:

`User` · `Business` · `Membership` (role) · `Party` · `FieldDefinition` +
`CustomFieldValue` (EAV for dynamic columns — typed, not raw JSON) ·
`Transaction` · `Payable` + `Payment` · `Receivable` + `Collection` ·
`Reminder` · `Notification` · `PushSubscription` · `Invoice` +
`InvoiceItem` · `AuditLog`.

Design decisions:
- Core financial truth (amounts, dates, payment history) is **never**
  modeled as a custom field — only supplementary business columns are.
- `CustomFieldValue` stores typed columns (`stringValue`/`numberValue`/
  `dateValue`/`boolValue`) rather than one JSON blob, so filtering/sorting
  can use indexed columns.
- `InvoiceItem.snapshot` freezes a JSON copy of a row's field values at
  invoice-generation time, so later field renames/edits never retroactively
  change a historical invoice.

---

## 4. Major business rules

- Payable and receivable are always tracked independently; a dashboard
  "net position" is a *display* computation, never a stored merged value.
- A payable/receivable's status and remaining balance are computed from
  its payments/collections and due date every time, never trusted from a
  stored flag.
- Reversing a payment/collection requires a reason and is logged; it never
  deletes the original row.
- A field cannot be archived while a live formula field still depends on
  it (checked server-side).
- A formula field can depend on other formula fields; the engine
  topologically sorts and computes them in dependency order, and rejects
  circular references at creation time.

---

## 5. API endpoints summary

```
POST   /api/auth/register            create user + first business
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/parties                  list (+ outstanding totals)
POST   /api/parties
GET    /api/parties/:id              detail + summary

GET    /api/fields?entity=           list dynamic fields
POST   /api/fields                   create (validates formula + cycles)
PATCH  /api/fields/:id                edit / archive (blocks unsafe archive)

GET    /api/transactions             list, filterable, paginated
POST   /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id          archives, never hard-deletes

GET    /api/payables                 list, filterable by status/party/date
POST   /api/payables
GET    /api/payables/:id
POST   /api/payables/:id/payments
POST   /api/payables/:id/payments/:paymentId/reverse

GET    /api/receivables              (mirror of payables)
POST   /api/receivables
GET    /api/receivables/:id
POST   /api/receivables/:id/collections
POST   /api/receivables/:id/collections/:collectionId/reverse

GET    /api/dashboard                 aggregate totals
GET    /api/calendar?from=&to=        due/expected events in range

GET    /api/notifications
PATCH  /api/notifications/:id         mark read
POST   /api/push/subscribe            register a Web Push subscription

GET    /api/invoices
POST   /api/invoices                  generate (snapshots rows)
GET    /api/invoices/:id
GET    /api/invoices/:id/pdf          streamed PDF download

POST   /api/cron/run-reminders        scheduler entrypoint (GET or POST — see below)
```

---

## 6. Notification architecture

`server/services/notification-providers.ts` defines a `NotificationProvider`
interface (`send(payload)`). Registered providers: `InAppProvider` (always
works, writes a `Notification` row), `PushProvider` (Web Push via VAPID —
falls back to a console warning if keys are unset, so the rest of the app
keeps working without credentials), and stub `SMS`/`EMAIL`/`WHATSAPP`
providers that log instead of sending. **Adding a real SMS/Email/WhatsApp
provider later means writing one class and registering it — no changes to
the reminder engine or API routes.**

### Reminder scheduler

The reminder engine (`runDueReminders()`) must be invoked periodically by a
real scheduler — it is intentionally *not* triggered by client-side timers.
Options:
- **Vercel Cron Jobs** — add a `vercel.json` cron entry hitting
  `/api/cron/run-reminders` with the `x-cron-secret` header.
- **Plain crontab** on a VPS: `*/30 * * * * curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app/api/cron/run-reminders`
  (also available as `npm run cron:reminders` with `APP_URL`/`CRON_SECRET`
  env vars set).
- **GitHub Actions** — `.github/workflows/reminder-cron.yml` is included,
  disabled by default; uncomment its `schedule` trigger and set the
  `APP_URL`/`CRON_SECRET` repo secrets to use it.

Set `CRON_SECRET` in your environment — the endpoint rejects requests
without a matching `x-cron-secret` header.

---

## 7. Formula engine

`server/utils/formula.ts` implements its own tokenizer → recursive-descent
parser → AST evaluator (never `eval`/`Function`). Given field definitions
like:

```
gross_amount = weight * rate
net_amount   = gross_amount - truck_rent
due          = net_amount - paid_amount
```

`resolveCalculationOrder()` topologically sorts these so `gross_amount`
computes before `net_amount` before `due`, and throws
`CircularDependencyError` for cycles (direct, self-referencing, or
indirect through multiple fields). `evaluateFormula()` treats missing/null
inputs as 0 and division by zero as 0, so an incomplete row never crashes
the ledger. See `tests/unit/formula.test.ts` for the full behavioral spec.

---

## 8. PDF / invoice flow

1. `POST /api/invoices` selects a party's transactions (explicit IDs or a
   date range), snapshots the configured dynamic-field columns per row
   into `InvoiceItem.snapshot`, and computes totals.
2. `GET /api/invoices/:id` reconstructs the preview from those frozen
   snapshots — later field edits never change a past invoice.
3. `GET /api/invoices/:id/pdf` renders the same data server-side with
   `pdfkit`, so the PDF is byte-consistent regardless of the requesting
   device (no client-side canvas/print rendering).

---

## 8b. Platform admin panel

Separate from the business app entirely — a different login, different
session cookie, and a different JWT secret derivation, so there's no
code path from admin access to a business user's password or session.

**One-time setup after first deploy:**
1. Set `ADMIN_BOOTSTRAP_SECRET` in your environment (any long random
   string), redeploy.
2. Call the bootstrap endpoint once to create your first Super Admin:
   ```bash
   curl -X POST https://your-app/api/admin/bootstrap \
     -H "Content-Type: application/json" \
     -d '{"secret":"YOUR_ADMIN_BOOTSTRAP_SECRET","name":"Your Name","email":"you@example.com","password":"a-strong-password"}'
   ```
   This only ever works once — it refuses if any admin already exists.
3. Log in at `/admin/login` with that email/password.
4. Optionally remove `ADMIN_BOOTSTRAP_SECRET` afterward (or rotate it) —
   nothing else depends on it once your Super Admin exists.

**What the admin panel does:**
- Dashboard: total/active/deactivated/trial account counts, signup code
  counts, recent signups.
- Users: search/filter by status, view profile info (name, email,
  business, activity counts) — **never** passwords or session tokens —
  and activate/deactivate/delete accounts.
- Signup codes: there is no open public registration. Every account is
  created by redeeming a code the admin generates after collecting
  payment out-of-band (bKash/Nagad/cash — tracked only via the code's
  free-text `notes` field, not processed by this app), or as a free
  trial with a chosen number of days. Codes can be revoked before use.
- Free trials: a `FREE_TRIAL` code sets `trialEndsAt` on the resulting
  Business. The same cron that runs reminders
  (`/api/cron/run-reminders`) also deactivates any business whose trial
  has passed — no separate scheduled job needed. A deactivated account
  is blocked at login and mid-session (a global server middleware
  checks status on every authenticated API call, not just at login).
- Sub-admins (Super Admin only): create additional admins with a
  specific subset of permissions (view users / manage status / delete /
  generate codes / manage other sub-admins). A Super Admin cannot be
  demoted or deleted by a sub-admin, and sub-admins cannot grant
  themselves more permissions than a Super Admin explicitly gave them.

## 9. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` for SQLite dev; Postgres URL in production |
| `JWT_SECRET` | Yes | Change before deploying |
| `CRON_SECRET` | For reminders | Shared secret the scheduler sends as `x-cron-secret` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | For push | Generate with `npx web-push generate-vapid-keys` |
| `NUXT_PUBLIC_APP_NAME` | No | Display name |

---

## 10. Setup / run commands (quick reference)

```bash
npm install --legacy-peer-deps
npx prisma generate
npm run db:migrate -- --name init
npm run db:seed          # optional demo data
npm run dev              # http://localhost:3000
npm test                 # unit tests
npm run typecheck
npm run build && npm run preview   # production build check
```

---

## 11. Testing instructions

```bash
npm test          # 31 unit tests: formula engine + money/status logic
npm run typecheck # full TS project check
```

CI (`.github/workflows/ci.yml`) runs the same pipeline plus a schema push
against an ephemeral SQLite DB and a production build, on every push.

---

## 12. Remaining external credentials/services

- **VAPID keys** for real Web Push delivery (`npx web-push
  generate-vapid-keys`). Without them, push silently no-ops and in-app
  notifications still work.
- **SMS / Email / WhatsApp** — provider classes are stubbed
  (`server/services/notification-providers.ts`); wire a real SDK
  (Twilio, SES/SendGrid, WhatsApp Cloud API, etc.) when you have
  credentials.
- **Postgres** connection string for production (see §1).
- **CRON_SECRET** + a scheduler (Vercel Cron, crontab, or the provided
  GitHub Actions workflow) to actually fire reminders in production.

## 13. Known limitations

- No migration history is committed yet (`prisma/migrations/` is empty) —
  run `npm run db:migrate -- --name init` once and commit the result; CI
  currently uses `prisma db push` as a stand-in until that exists.
- PWA icons in `public/icons/` are simple placeholders generated for this
  build — replace with real branded icons (512×512 maskable-safe) before
  shipping.
- No end-to-end/integration tests against a live database yet (only pure
  unit tests) — the sandboxed build environment couldn't reach Prisma's
  engine-binary host to run one; CI is set up to do this going forward.
- `npm run typecheck` currently reports a large number of errors that
  appear to be a `nuxt typecheck`/`vue-tsc`/`typescript` version
  interaction rather than real code issues (even `nuxt.config.ts`'s own
  `defineNuxtConfig` shows as unresolved, which should never happen in a
  working setup) — CI runs it as non-blocking for now. Worth revisiting
  with a clean reproduction once you have full network access to try
  different `vue-tsc`/`typescript` version pairings.
- Offline financial editing is intentionally unsupported (per spec) — the
  service worker only caches the static app shell, not API data.
- Multi-currency is modeled (`Business.currency`) but formatting assumes
  2 decimal places; adjust `formatCurrency`/`useCurrency` if you add a
  0-decimal currency.

## 14. Recommended next improvements

- Field reordering drag-and-drop UI (the API supports `sortOrder` already).
- Bulk transaction import from spreadsheet (CSV/XLSX) mapped to dynamic
  fields.
- Role-based UI gating to match the server's OWNER/ADMIN/STAFF/VIEWER
  permission checks (currently enforced server-side only).
- Multi-business switcher for users who are members of more than one
  workspace (schema already supports it via `Membership`).
- Real SMS/WhatsApp reminders once credentials are available.
