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
