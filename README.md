# Brightloop

Subscription management in one place: plans, quotations, subscriptions, automatic invoicing on billing day, taxes, discounts, payments and a finance dashboard. Every period is billed once and never skipped.

Brightloop is a single Next.js application with three areas:

- **Back office** (`/dashboard`, `/subscriptions`, `/invoices`, `/payments`, `/customers`, `/billing`, `/catalog/*`, `/settings/users`, `/outbox`) for administrators and staff.
- **Customer portal** (`/portal`) for customers, limited to their own subscriptions and invoices.
- **Billing engine** (`src/lib/billing/*`): a pure invoice calculator plus an idempotent billing run that can be started from a button, a cron route or the command line.

## Features by role

| Area | Admin | Staff | Customer |
|---|:-:|:-:|:-:|
| Dashboard: active subscriptions, MRR, collections, outstanding, overdue, 12-month chart, filters | ✅ | ✅ | |
| Products with variants (e.g. Brand = Odoo, +₹560), plans with availability and option flags | ✅ | read only | |
| Quotation templates, taxes, payment terms | ✅ | read only | |
| Discount rules (fixed or %, minimum purchase or quantity, date range, usage limit) | ✅ | read only | |
| Customers and subscriptions: quote, confirm, activate, pause, resume, renew, close | ✅ | ✅ | |
| Attach discounts to subscriptions; next-invoice preview | ✅ | ✅ | |
| Run billing (manual or cron), generate one subscription's invoice | ✅ | ✅ | |
| Invoices: confirm, cancel, send, print; bulk confirm of drafts | ✅ | ✅ | |
| Record payments (partial or full); overdue highlighting | ✅ | ✅ | |
| Add and deactivate staff; email outbox (password reset links) | ✅ | | |
| Accept or decline a quotation, pause, resume, renew or close (where the plan allows) | | | ✅ |
| View own invoices, overdue amounts and bank transfer details; print | | | ✅ |
| Browse public plans and ask for a quote | | | ✅ |

Business rules that matter:

- Money is stored as integer paise. Percentages are basis points.
- Billing is in advance: the invoice for a period is created on the period's start date.
- Subscription lifecycle: Draft → Quotation → Confirmed → Active → Closed, with Paused as a side state. Every change is written to the activity timeline.
- Taxes are computed from the rules on the product and snapshotted onto each invoice line.
- Discounts apply automatically to every invoice while they are valid, and stop when they expire or run out of uses.

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript
- PostgreSQL 16 with Prisma 6
- Server Actions with zod validation
- Custom authentication: bcrypt password hashes and a signed JWT in an httpOnly cookie
- Tailwind CSS v4, Recharts for charts, sonner for toasts, lucide-react icons

## Setup

Requirements: Node.js 20.12 or later, npm, and Docker (or any PostgreSQL 16 database).

```bash
docker compose up -d          # PostgreSQL 16 on localhost:5432
cp .env.example .env          # then set SESSION_SECRET and CRON_SECRET
npm install
npm run db:deploy             # apply the migrations
npm run db:seed               # demo data
npm run dev                   # http://localhost:3000
```

Without Docker, point `DATABASE_URL` at any PostgreSQL 16 database (for example a free Neon or Supabase instance).

Environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Signs session cookies. Use at least 32 random characters. |
| `APP_URL` | Base URL used in email links |
| `CRON_SECRET` | Shared secret for `POST /api/cron/billing` |
| `CURRENCY` | Display currency (default `INR`) |
| `SEED_SCALE` | Number of generated customers in the seed (default `200`; `5000` for the performance test) |
| `SMTP_*` | Optional. Without `SMTP_HOST`, emails are only written to the outbox. |

Seeding is safe to repeat: it wipes the tables first. `SEED_SCALE=5000 npm run db:seed` creates about 5,000 subscriptions and 37,000 invoices.

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@brightloop.test` | `Admin@12345` |
| Staff | `staff@brightloop.test` | `Staff@12345` |
| Customer | `customer@brightloop.test` | `Customer@12345` (linked to the customer "Acme Retail") |

These accounts exist only in the demo seed.

### Demo walkthrough

1. Log in as the customer and open **My subscriptions**. Acme has a valid quotation to accept or decline, and an active plan with overdue invoices.
2. Log in as staff. The dashboard shows overdue invoices, MRR and the 12-month chart. Customers with subscriptions due today are ready for billing.
3. Open **Billing run**, pick a date, and run billing. Run it again: the second run creates nothing.
4. Open an invoice to see lines, the Odoo variant, GST and any discount, then record a payment.

## How billing day works

Billing is a single function, `runBilling(today, triggeredBy)`, with three entry points:

- **Billing run page**: the "Run billing" button at `/billing` (admin and staff), with an optional "as of" date for demos.
- **Cron route**: `POST /api/cron/billing` with the header `x-cron-secret: <CRON_SECRET>`. Schedule it daily, for example at 00:00 UTC.
- **Command line**: `npm run billing:run`.

Each run does four things, in order:

1. **Activate**: confirmed subscriptions whose start date has arrived become active.
2. **Invoice**: for each active subscription, every period whose start is on or before the run date gets one draft invoice, computed by the same engine as the preview. Subscriptions are processed in batches of 200, and each subscription runs in its own transaction, so one failure does not stop the others.
3. **Auto-close**: subscriptions on plans with auto-close whose term has ended are closed.
4. **Record**: a `BillingRun` row stores the counts (activated, invoiced, closed, skipped, errors) for the billing run history.

### No double billing

- The database has a unique constraint on `(subscriptionId, periodStart)` for invoices. Even two runs at the same time cannot create the same period twice.
- Each subscription counts its billed periods (`periodsBilled`). An update guarded by that count stops a second writer from advancing the same subscription.
- Periods are always computed from the subscription's start date, never chained from the previous period, so month-end dates do not drift (31 Jan, 28 Feb, 31 Mar).
- Re-running a date creates no invoices and reports the periods as skipped.
- Discount usage is claimed atomically, so a limited discount cannot be applied more times than allowed.

## Project structure

```
prisma/
  schema.prisma          data model (money in paise, percentages in basis points)
  migrations/            SQL migrations, applied with npm run db:deploy
  seed.ts                demo data and SEED_SCALE generator
src/
  app/
    (auth)/              login, signup, forgot and reset password
    (backoffice)/        dashboard and back-office pages, guarded by role
    portal/              customer portal, guarded by role and ownership checks
    api/cron/billing/    billing cron endpoint
  lib/
    billing/             pure invoice computation, period maths, MRR helpers
    subscriptions/       lifecycle state machine and transitions
    auth/                password rules, sessions, guards
    dates.ts, money.ts   UTC date helpers and paise formatting
  server/
    actions/             server actions with validation and permission checks
    queries/             read queries for dashboards and lists
  components/            shared UI (tables, badges, KPI cards, stepper)
```

The rules in `src/lib/billing` and `src/lib/subscriptions/state.ts` do not import Prisma, so they can be unit-tested on their own.
