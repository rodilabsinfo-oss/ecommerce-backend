# Ecommerce Backend

Node + Express 5 + TypeScript, Postgres via Prisma 7.

## Setup

```bash
npm install
cp .env.example .env        # then set DATABASE_URL
npm run db:migrate -- --name init
npm run db:seed             # creates the "main" store
npm run dev                 # http://localhost:4000
```

## Layout

```
prisma/schema.prisma        database tables
src/
  config/env.ts             checked environment variables
  lib/                      prisma client, logger, errors, money helpers
  middleware/               error handler, request validation
  modules/<feature>/        one folder per feature (routes, service, schemas)
    stores/                 which shop a request is for + per-shop settings
    payments/               payment provider layer (COD now, wallets later)
```

## Rules

- Every main table has `storeId`. Every query must filter by `req.store.id`.
- Money is whole paisa (`Int`). Rs 1,250.50 = `125050`.
- A client's look, contact details and enabled payments live in `Store.settings`
  (see `modules/stores/store-settings.ts`). Never fork the code per client.
- New payment method = one file in `modules/payments/providers/` + one line in
  `payment.registry.ts`, then enable it in the shop's settings.

## Endpoints so far

| Method | Path | |
|---|---|---|
| GET | `/health` | API + database status |
| GET | `/api/v1/store/current` | shop name, theme, contact, tracking ids |
| GET | `/api/v1/payments/methods` | payment options for checkout |
| GET | `/api/v1/categories` | category tree |
| GET | `/api/v1/products` | product list — `category`, `q`, `size`, `colour`, `minPrice`, `maxPrice` (paisa), `inStock`, `featured`, `sort` (`newest`/`price_asc`/`price_desc`/`name`), `page`, `limit` |
| GET | `/api/v1/products/facets` | filter choices for a `category` / `q`: sizes, colours, price range |
| GET | `/api/v1/products/:slug` | product page: options, variants, photos |
| POST | `/api/v1/cart/quote` | `{ items: [{ variantId, quantity }] }` → current prices, stock problems per line, delivery fee, totals |
| POST | `/api/v1/orders` | place a COD order (send a random `Idempotency-Key` header per attempt) |
| GET | `/api/v1/orders/:number?phone=98…` | order status + timeline for the buyer |

Catalogue responses send short cache headers so a CDN can serve them.
Wholesale price is never returned by public endpoints.
Add `?lang=ne` to get Nepali names (falls back to English).

### Checkout rules

- Prices and stock are always re-checked on the server; the cart in the browser is only a list of ids.
- Stock is taken inside the order transaction with a "stock >= quantity" guard, so two buyers can never get the last piece.
- Names and prices are copied onto the order, with the supplier and wholesale price per item for payouts.
- Checkout is rate limited (10 per 10 minutes per buyer); order data is never cached.

Send `X-Store: <slug>` to pick a shop; otherwise it is matched by domain, then `DEFAULT_STORE_SLUG`.

## Admin API (`/api/v1/admin`)

Sign in with `POST /admin/auth/login { email, password }`. The session is an httpOnly cookie (`sid`);
scripts can send `Authorization: Bearer <token>` instead. Sessions last `SESSION_DAYS` and are revocable.

| Role | Can use |
|---|---|
| STAFF | dashboard, orders, customers |
| ADMIN | + products, variants, photos, categories, suppliers |
| OWNER | + supplier payouts, shop settings, staff accounts |

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password` |
| Dashboard | `GET /dashboard` — today / 30 days, status counts, 14-day chart, low stock, top products |
| Orders | `GET /orders?status&q&from&to&page`, `GET /orders/:number`, `POST /orders/:number/status { status, note }`, `PATCH /orders/:number { staffNote }` |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `POST /products/:id/variants`, `PATCH /variants/:id`, `PATCH /option-values/:id` |
| Photos | `POST /products/:id/images` (multipart `photos[]`, optional `optionValueId`), `PUT /products/:id/images/order { ids }`, `PATCH/DELETE /images/:id` |
| Categories | `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Suppliers | `GET/POST /suppliers` (with amount owed), `PATCH/DELETE /suppliers/:id` |
| Payouts | `GET/POST /payouts`, `GET /payouts/:id`, `POST /payouts/:id/paid`, `DELETE /payouts/:id` |
| Customers | `GET /customers?q`, `GET /customers/:id` |
| Settings | `GET/PATCH /settings` (partial updates: `{ settings: { theme: { preset: "bloom" } } }`) |
| Staff | `GET/POST /staff`, `PATCH /staff/:id` |

### Order statuses

```
PENDING → CONFIRMED → (PROCESSING) → SHIPPED → DELIVERED → RETURNED
   └────────┴──────────────┴─→ CANCELLED
```

- Cancelled / returned orders put their stock back.
- Delivered COD orders are marked paid; returned paid orders become refunded.
- Every change is saved in the order history with the staff member who made it.

### Supplier payouts

A supplier is owed the wholesale price × quantity of every **delivered** item not yet in a payout.
`POST /payouts { supplierId }` bundles it; `POST /payouts/:id/paid` records the payment.

### Photos

Uploads are turned into WebP (max 2000px, rotation fixed, camera data removed).
`STORAGE_DRIVER=local` keeps them in `./uploads` (development); `s3` uses any S3-compatible
bucket such as Cloudflare R2 — set the `S3_*` variables in `.env`.

### First owner account

```bash
npm run staff:create -- --email you@shop.com --name "Your Name" --role OWNER --password "a-long-password"
```

`npm run db:seed` also creates `owner@demo.local` / `demo-owner-123` outside production.
