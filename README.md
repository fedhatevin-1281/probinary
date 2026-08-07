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
