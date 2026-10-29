# Pro Binary

This project is a Vite + React + Tailwind app and is ready to deploy to Vercel as a static frontend.

## Vercel Deployment

1. Import the repository in Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add environment variables from `.env.example` if you use an external backend.
6. Deploy.

## Environment Variables

- `VITE_API_URL`: HTTP base URL for backend calls (example: `https://api.example.com`).
- `VITE_WS_URL`: WebSocket URL for live trading (example: `wss://ws.example.com`).
- `VITE_USD_KES_RATE`: optional default conversion rate.
- `NOWPAYMENTS_API_KEY`: server-side NOWPayments API key.
- `NOWPAYMENTS_IPN_SECRET`: server-side NOWPayments IPN secret used to authenticate callbacks.
- `APP_BASE_URL`: public HTTPS origin for checkout return URLs and the IPN callback (for example, `https://app.example.com`).
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `JWT_SECRET`: required by the API and wallet backend.

### NOWPayments Setup

1. Run `nowpayments.sql` in the Supabase SQL Editor. Rerun the updated script on existing installations to add the payment-address fields. It creates the private order table and atomic wallet functions used to prevent duplicate credits and balance overwrites.
2. Add `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, and `APP_BASE_URL` to the auth API environment. Keep these values server-side; do not use `VITE_` prefixes.
3. The app sends `${APP_BASE_URL}/api/payments/nowpayments/webhook` as the IPN callback URL when it creates each invoice. Keep that route publicly reachable over HTTPS.
4. Enable the supported coins and networks you want to offer in your NOWPayments account. Customers choose an available currency in the deposit panel and receive its payment address and QR code in the app.
5. For local development, expose the app and auth API through one public HTTPS origin (with `/api` routed to the auth API) and set `APP_BASE_URL` to that origin. NOWPayments cannot send IPNs to localhost.

Wallet credit is granted only for a signed `finished` IPN whose order, payment ID, and USD amount match the stored payment. A browser redirect alone never credits funds.

If `VITE_API_URL` and `VITE_WS_URL` are not set, the app auto-derives from the current browser origin.

## Important Backend Note

The included `server.js` runs a long-lived WebSocket server. Vercel serverless/functions are not suitable for this style of persistent WebSocket backend.

Deploy backend separately (for example: Fly.io, Railway, Render, a VM, or Kubernetes) and set:

- `VITE_API_URL`
- `VITE_WS_URL`

## Local Development

```bash
npm install
npm run dev
```

Optional local backend:

```bash
npm run server
```

## Authentication + RBAC Backend

This repository now includes a secure authentication API with role-based access control and Supabase/PostgreSQL persistence.

### Role Model

- `client`
- `admin`
- `super_admin`

### Key Security Rules Implemented

- Passwords are hashed with `bcrypt`.
- Public auth (`/api/auth/*`) supports client registration/login/password reset.
- Admin and Super Admin users cannot authenticate through client login.
- Private admin portal auth is served from `/api/admin/login`.
- Only users with `admin` or `super_admin` roles can access admin portal routes.
- Only `super_admin` can create/manage admin accounts.
- Wallet balance updates for M-Pesa completion are wrapped in DB transactions.

### Backend Files

- Supabase schema: `backend/sql/schema.supabase.sql`
- Local SQLite schema: `backend/sql/schema.sql` (reference only)
- API app: `backend/app.js`
- API server: `backend/server.js`
- Auth services: `backend/services/authService.js`
- Wallet/M-Pesa services: `backend/services/walletService.js`

### Run the Auth API

```bash
npm run auth:server
```

Required backend environment variables:

- `SUPABASE_DB_URL` (direct Postgres connection string from Supabase)
- `JWT_SECRET`

### Bootstrap Initial Super Admin

1. Set these env vars:
	 - `BOOTSTRAP_SUPER_ADMIN_EMAIL`
	 - `BOOTSTRAP_SUPER_ADMIN_USERNAME`
	 - `BOOTSTRAP_SUPER_ADMIN_PASSWORD`
2. Run:

```bash
npm run auth:bootstrap-super-admin
```

### Auth and Portal Routes

- Client auth:
	- `POST /api/auth/register`
	- `POST /api/auth/login`
	- `POST /api/auth/password-reset/request`
	- `POST /api/auth/password-reset/confirm`
- Admin portal:
	- `POST /api/admin/login`
	- `GET /api/admin/dashboard`
	- `GET /api/admin/super-admin/dashboard`
	- `POST /api/admin/accounts` (super admin only)
	- `PATCH /api/admin/accounts/:userId/status` (super admin only)
- Wallet + M-Pesa preparation:
	- `GET /api/wallet/me`
	- `GET /api/wallet/me/transactions`
	- `POST /api/wallet/mpesa/deposits`
	- `POST /api/wallet/mpesa/deposits/:paymentReference/complete`
	- `POST /api/wallet/mpesa/deposits/:paymentReference/fail`
