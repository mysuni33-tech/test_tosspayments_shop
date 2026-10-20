# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

OUTFIT is a demo clothing shop. The frontend is plain HTML/CSS/vanilla JS with no build step or framework. Payments go through the Toss Payments widget SDK v2. Data (products, stock, orders, members, carts, wishlists, reviews) lives in Supabase. `server.js` is a dependency-free Node.js server that serves the static files and does everything that needs a secret key: order creation, payment approval, failure recording, cancel/refund, and admin status changes. The UI text and code comments are in Korean.

## Commands

```bash
node server.js                          # http://localhost:8080 (PORT env overrides)
```

`server.js` reads `.env` itself (see `.env.example`). `SUPABASE_SECRET_KEY` is required for any `/api/*` call; without it the pages still load but ordering returns a "DB 키가 설정되지 않았습니다" error.

There is no package.json and nothing to build, lint, or test. Pages must be served by `server.js`. Opening the HTML files directly breaks the payment widget and the `/api/*` calls.

On this Windows machine, Node.js and Git were installed via winget. A shell that was started before the install may need PATH refreshed: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.

## Architecture

**Pages.** `index.html` (tops), `shoes.html`, `pants.html` share markup and differ only in `<body data-category="top|shoes|pants">`; if you change their header, modal, or drawer markup, update all three. Other pages: `checkout.html`, `success.html`, `fail.html`, `login.html` (login + signup tabs), `mypage.html` (orders · wishlist · my info), `admin.html` (orders · products).

**Script load order.** Every page loads globals in this order: supabase-js UMD from jsDelivr (`@2.105.0`) → `js/products.js` → `js/db.js` → `js/cart.js` → page script (`shop.js`, `checkout.js`, `mypage.js`, `admin.js`, or inline).
- `products.js`: shared, DOM-free helpers (`SIZES`, `productImage`, `salePrice`, `deliveryFee`, `won`, `ORDER_STATUS`, `CATEGORY_LABEL`). `server.js` runs this same file in a `vm` context so pricing matches. Keep it a plain script with no DOM or module syntax. It no longer holds product data.
- `db.js`: Supabase client with the **publishable** key, `Auth` (`Auth.ready` promise, `Auth.user`, `Auth.profile`, `Auth.isAdmin`, `Auth.require()`), `Catalog` (loads active products + `product_stock` from the DB; `findProduct`, `stockOf`), `api()` (POSTs to the server with the user's access token), `esc()` for HTML escaping, and header login/logout/admin links (`.auth-link`, `.admin-link`).
- Always `esc()` DB text before putting it in `innerHTML` (reviews are user-written).

**Cart and order state.**
- The cart lives in `localStorage` (`outfit_cart`). For a logged-in member it is mirrored to `cart_items` via the `replace_cart` RPC. `outfit_cart_owner` records which user the local cart belongs to: on load, if it matches, the DB cart wins; if not (items added before login), local and DB carts are merged. Logout clears the local cart. `Cart.synced` resolves after this sync.
- "Buy now" writes a single item to `sessionStorage` (`outfit_order`); `getOrderItems()` reads that first.
- `sessionStorage.outfit_pending` holds `{orderId, direct}` between checkout and `success.html` so the cart is cleared only once.

**Payment flow.** The server and DB are the authority on price and stock.
1. `POST /api/orders` (optional `Authorization: Bearer <access token>` links the order to the member): server reads prices and stock from the DB, rejects out-of-stock lines, computes the amount, and inserts `orders` (status `PENDING`) + `order_items`.
2. `widgets.requestPayment()` → Toss → `success.html?paymentKey&orderId&amount` or `fail.html?code&message&orderId`. If the widget promise rejects (user closed it), `checkout.js` calls `/api/orders/:id/fail`.
3. `POST /api/confirm`: RPC `order_begin_confirm` locks the order, checks amount, checks and deducts stock, and sets `stock_deducted` (a second concurrent call gets `IN_PROGRESS`). Then Toss `/v1/payments/confirm`. On failure, `order_mark_failed` restores stock and records the reason. On success the order becomes `PAID` with method/approved_at/receipt_url. A repeat call with the same paymentKey returns the stored result (refresh-safe).
4. Cancel: `POST /api/orders/:id/cancel` (owner for `PAID`/`PREPARING`, admin also for `SHIPPING`/`DELIVERED`) → Toss `/v1/payments/{paymentKey}/cancel` → `order_mark_canceled` restores stock.
5. Admin status: `POST /api/admin/orders/:id/status` only moves `PAID → PREPARING → SHIPPING → DELIVERED`.

**Server code layout.** All `/api/*` logic lives in `lib/api.js` (`handleApi(method, pathname, body, authorization)` → `{status, data}`). Two thin entry points use it: `server.js` (local dev: `.env` loading + static files) and `api/handler.js` (Vercel function). Add new endpoints in `lib/api.js` `route()` only.

**Vercel.** Project `test_tosspayments_shop` (Hobby, team `at-im1`) is connected to the GitHub repo: pushes to `main` deploy to https://testtosspaymentsshop-orcin.vercel.app, other branches get preview deployments. `vercel.json` copies only `*.html`, `css/`, `js/` into `dist/` (so `server.js`, `lib/`, docs are not public), bundles `js/products.js` into the function, and rewrites `/api/:path*` → `/api/handler?path=:path*`. `SUPABASE_SECRET_KEY` (and optionally `TOSS_SECRET_KEY`) must be set as Vercel environment variables.

**Static file allowlist.** Locally, `server.js` only serves paths that match the `PUBLIC` regex: root-level `*.html` and files under `css/`, `js/`, and `images/`. This also keeps `server.js` and `.env` from being served.

## Supabase

Project `outfit-shop` (ref `scjzbrghhsnaprjcguly`, free tier, ap-northeast-2). Schema lives only in Supabase migrations (`init_shop_schema`, `seed_products`, `tighten_table_grants`); there are no local SQL files.
- Tables: `profiles` (auto-created by trigger on signup; `is_admin` is true for `mysuni33@gmail.com`), `products`, `product_stock` (per size), `orders`, `order_items`, `cart_items`, `wishlists`, `reviews` (one per user per product; a trigger sets `user_id` and the masked `author_name`).
- Security: RLS on every table plus explicit column/table grants. Supabase's default "all privileges" grants were revoked, so a new table needs explicit `grant`s. Members can update only `profiles.name/phone/address/address_detail`; nobody but the server writes `orders`. Admin access goes through `is_admin()`. The stock/order RPCs (`order_begin_confirm`, `order_mark_failed`, `order_mark_canceled`, `order_restore_stock`) are executable only by `service_role`.
- The server talks to PostgREST with the secret key in the `apikey` header only. New-style secret keys (`sb_secret_...`) fail with `Invalid JWT` if sent as `Authorization: Bearer`. The server verifies a member's access token with `GET /auth/v1/user`.
- The Supabase MCP cannot return the secret key or change Auth settings (Confirm email, Site URL). The user has to do those in the dashboard.

## Keys

- Toss: public **docs test keys** by default (never charge real money). Client key `TOSS_CLIENT_KEY` in `js/checkout.js`; secret key `TOSS_SECRET_KEY` env, falling back to the docs key in `server.js`.
- Supabase: publishable key in `js/db.js` (safe to expose); secret key only in `.env` as `SUPABASE_SECRET_KEY`.

## MCP

`.mcp.json` registers the Toss Payments integration-guide MCP server (`@tosspayments/integration-guide-mcp`, launched via `cmd /c npx`). It provides tools for looking up Toss docs, such as `get-documents`. Prefer it over guessing SDK or API details.
