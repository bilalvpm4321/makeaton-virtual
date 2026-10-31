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
- PostgreSQL with Prisma 6: PostgreSQL 16 in Docker for local development, Neon Postgres in production
- Server Actions with zod validation
- Custom authentication: bcrypt password hashes and a signed JWT in an httpOnly cookie
- Tailwind CSS v4, Recharts for charts, sonner for toasts, lucide-react icons

## Local development

Requirements: Node.js 22 (see `engines` in `package.json`), npm, and Docker (or any PostgreSQL 16 database).

```bash
docker compose up -d          # PostgreSQL 16 on localhost:5432
cp .env.example .env          # then set SESSION_SECRET and CRON_SECRET
npm install
npm run db:deploy             # apply the migrations
npm run db:seed               # demo data
npm run dev                   # http://localhost:3000
```

Without Docker, point `DATABASE_URL` at any PostgreSQL 16 database (for example a Neon branch; seeding it then needs `ALLOW_DEMO_SEED=true`, see [Demo data](#demo-data)). Every variable is documented in `.env.example`, and the production list is in [Environment variables](#environment-variables).

Seeding wipes the tables first, so run it only against a local database. See [Demo data](#demo-data).

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@brightloop.test` | `Admin@12345` |
| Staff | `staff@brightloop.test` | `Staff@12345` |
| Customer | `customer@brightloop.test` | `Customer@12345` (linked to the customer "Acme Retail") |

Only the demo seed creates these accounts. `npm run db:bootstrap` does not.

### Demo walkthrough

1. Log in as the customer and open **My subscriptions**. Acme has a valid quotation to accept or decline, and an active plan with overdue invoices.
2. Log in as staff. The dashboard shows overdue invoices, MRR and the 12-month chart. Customers with subscriptions due today are ready for billing.
3. Open **Billing run**, pick a date, and run billing. Run it again: the second run creates nothing.
4. Open an invoice to see lines, the Odoo variant, GST and any discount, then record a payment.

## Production deployment

Production runs on **Vercel** with a **Neon** Postgres database. The Vercel region is set in `vercel.json`.

### Architecture

- **Vercel** serves the Next.js app and runs the daily billing cron (`vercel.json`). Every push to `main` deploys automatically.
- **Neon Postgres** holds the data. The app connects through the **pooled** URL (the host contains `-pooler`) in `DATABASE_URL`. Migrations use the **direct** URL in `DATABASE_URL_UNPOOLED`, because the pooler is not suitable for schema changes.
- The Vercel build runs `npm run vercel-build`: `prisma migrate deploy` against the direct URL, then `next build`. Migrations apply before the build finishes, and a failed migration fails the build, so the previous deployment keeps serving traffic.
- Vercel runs this script for Preview builds too. Scope `DATABASE_URL_UNPOOLED` to Production only, or give Preview its own database, so a preview build never migrates production.

### Environment variables

Set these in Vercel for the **Production** environment. The full list with comments is in `.env.example`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Neon connection string (host contains `-pooler`) used by the app. |
| `DATABASE_URL_UNPOOLED` | Yes | Direct Neon connection string used by `prisma migrate deploy` in the build. |
| `SESSION_SECRET` | Yes | Signs session cookies. At least 32 random characters (`openssl rand -hex 32`). |
| `APP_URL` | Yes | Public base URL, `https://makeaton-virtual.vercel.app`. Used in email links and to check the origin of sign-in requests. |
| `CRON_SECRET` | Yes | Authorises the billing cron. Vercel Cron sends it as a Bearer token. |
| `CURRENCY` | No | Display currency. Default `INR`. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | For Google sign-in | Firebase web API key. Public; embedded at build time. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | Firebase auth domain. Defaults to `<project-id>.firebaseapp.com`. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | For Google sign-in | Firebase project ID. The server checks ID tokens against it. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No | Firebase web app ID. |
| `RESEND_API_KEY` | For email | Resend API key used to send emails. |
| `MAIL_FROM` | For email | Sender address, for example `Brightloop <billing@your-domain.com>`. The domain must be verified in Resend. |
| `MAIL_REPLY_TO` | No | Reply-to address for emails. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | Optional SMTP sender. Without `SMTP_HOST`, emails are only logged to the outbox. |
| `SHOW_DEMO_LOGINS` | No | Shows the demo logins on the sign-in page. Keep `false` in production. |
| `ADMIN_EMAIL` | For bootstrap | Email of the admin account created by `npm run db:bootstrap`. |
| `ADMIN_NAME` | No | Display name of that admin. Default `Administrator`. |
| `ADMIN_PASSWORD` | For bootstrap | Password of that admin. It must be more than 8 characters with an uppercase letter, a lowercase letter and a special character. Used only by the bootstrap command. |
| `BOOTSTRAP_RESET_PASSWORD` | No | Set to `true` once to replace the password of an existing admin. |
| `ALLOW_DEMO_SEED` | No | Lets `npm run db:seed` run against a production or Neon database. Never set it in Vercel. |

### First-time setup

1. **Create the database.** In Neon, create a project and copy both connection strings: the pooled one (host contains `-pooler`) and the direct one.
2. **Set the variables in Vercel.** Open the project's Settings → Environment Variables and add the required variables for the Production environment. Leave `ALLOW_DEMO_SEED` unset.
3. **Deploy.** Push to `main` or redeploy in Vercel. The build applies the migrations to the empty database, so the schema exists after the first deploy.
4. **Create the admin.** Production does not create an admin on its own. From your machine, pull the production variables and run the bootstrap command:

   ```bash
   vercel env pull .env.production.local --environment=production
   set -a; source .env.production.local; set +a
   export ADMIN_EMAIL="you@your-domain.com" ADMIN_PASSWORD="<a strong password>"
   npm run db:bootstrap
   ```

   The command is idempotent and deletes nothing. It creates the admin, adds the default taxes and payment terms only if those tables are empty, and creates the sequences if they are missing. Running it again changes nothing. Remove `.env.production.local` when you are done. It is gitignored, but it holds secrets.

### Google sign-in (Firebase)

1. In the [Firebase console](https://console.firebase.google.com), create a project, or open an existing one.
2. Open **Authentication → Sign-in method**, enable **Google** and save.
3. Open **Authentication → Settings → Authorized domains** and add `makeaton-virtual.vercel.app`. `localhost` is authorized by default, so local development works without changes.
4. Open **Project settings → General → Your apps**, add a **Web app**, and copy `apiKey`, `authDomain`, `projectId` and `appId` from the config object.
5. In Vercel, set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID` for Production, then redeploy. These values are embedded at build time, so any change needs a new build. The "Continue with Google" button appears once the API key and project ID are set.

### Email (Resend)

1. In Resend, add your sending domain and create the DNS records it lists (DKIM and SPF) at your DNS provider. Wait until Resend shows the domain as verified.
2. Create a Resend API key with permission to send. Set `RESEND_API_KEY` in Vercel.
3. Set `MAIL_FROM` to an address on the verified domain, for example `Brightloop <billing@your-domain.com>`. Resend rejects mail from a domain it has not verified. Optionally set `MAIL_REPLY_TO`.

### Daily billing cron

`vercel.json` schedules `GET /api/cron/billing` every day at 00:00 UTC (`0 0 * * *`). Vercel Cron runs only on production deployments. The route checks `Authorization: Bearer $CRON_SECRET` and runs the billing run for the current UTC date. Runs are idempotent, so a repeated run creates no invoices. Results appear in the billing run history on `/billing`.

To run billing manually, send `POST /api/cron/billing` with the header `x-cron-secret: $CRON_SECRET` and an optional body `{"date": "YYYY-MM-DD"}`.

### Health check

`GET /api/health` is the health endpoint for uptime monitoring. It should return HTTP 200 when the app and the database are reachable.

### Backups and restore

Neon keeps the change history of each branch, so you can restore to an earlier point in time within the retention period of your Neon plan.

- **Before a risky change**, create a branch of the production branch in Neon. Branches are copy-on-write and take seconds. Test the migration or change on the branch first.
- **To restore**, create a new branch from the production branch at a point in time before the problem (Neon console → Branches → Create branch → past point in time). Check the data on the restored branch. Then either point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` at it in Vercel and redeploy, or copy the rows you need back into production.
- Restoring a branch in place replaces its current data. Take a branch snapshot first so you can roll back.

### Demo data

`npm run db:seed` wipes every table and fills the database with demo data. It is for local development only. The script refuses to run when `NODE_ENV` is `production`, when `VERCEL` is set, or when `DATABASE_URL` points at a `neon.tech` host. To override that, set `ALLOW_DEMO_SEED=true`, which is only appropriate for a throwaway Neon branch. Never set it in Vercel, and never seed the production database.

## How billing day works

Billing is a single function, `runBilling(today, triggeredBy)`, with three entry points:

- **Billing run page**: the "Run billing" button at `/billing` (admin and staff), with an optional "as of" date for demos.
- **Cron route**: `POST /api/cron/billing` with the header `x-cron-secret: <CRON_SECRET>`, plus the daily `GET` run from Vercel Cron (see [Daily billing cron](#daily-billing-cron)).
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
  migrations/            SQL migrations, applied with npm run db:deploy (and on every Vercel build)
  seed.ts                demo data and SEED_SCALE generator (local only, guarded)
  bootstrap.ts           idempotent production setup: admin, default taxes and payment terms, sequences
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
