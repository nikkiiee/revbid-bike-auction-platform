# RevBid — Bike Auction Platform

A full-stack starter implementation for used-motorcycle auctions. React/Vite client, Express API, MongoDB persistence, Socket.IO live events, JWT authentication, role-based admin endpoints, structured logs, health endpoints, input validation, and an auction lifecycle worker.

> **Scope honesty:** this repository is a runnable implementation baseline, not yet a fully audited production service. It includes a polished buyer-facing UI and core API flows. Before public launch, complete the hardening checklist in `docs/ARCHITECTURE.md`, run concurrency tests against a replica-set MongoDB, add a proper admin management UI, and deploy using your own hosting accounts. No live URL or credentials are fabricated.

## Requirements
- Node.js 20+
- MongoDB 6+ configured as a **replica set** (bid placement uses a MongoDB transaction)

## Local setup

```bash
cp .env.example .env
# Edit .env: set a long random JWT_SECRET and your MongoDB replica-set URI
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:5000
- Liveness: http://localhost:5000/health/live
- Readiness: http://localhost:5000/health/ready

For local replica-set MongoDB, a single-node replica set is sufficient for development; configure `MONGODB_URI=mongodb://127.0.0.1:27017/bike_auction?replicaSet=rs0` and initialize the replica set once. Plain standalone MongoDB will fail bid transactions.

## Environment variables
See `.env.example`. Never commit `.env` or production secrets. Set `CLIENT_ORIGIN` to the exact deployed frontend origin, `VITE_API_URL` to the deployed API `/api` URL, and `VITE_SOCKET_URL` to the API origin when building the frontend.

## API overview
- `POST /api/auth/register` — create buyer account
- `POST /api/auth/login` — receive signed JWT
- `GET /api/auth/me` — current authenticated user
- `GET /api/auctions?page=1&limit=12&status=live&q=honda` — paginated search
- `GET /api/auctions/:id` — auction details and recent bids
- `GET /api/auctions/:id/bids` — bid history
- `POST /api/auctions/:id/bids` — authenticated bid; body: `{ "amount": 123000, "idempotencyKey": "a-unique-key-123" }`
- `POST /api/auctions` — admin-only create auction
- `PATCH /api/auctions/:id/cancel` — admin-only cancel an auction with no bids
- `GET /health/live`, `GET /health/ready`

Socket.IO events: client emits `auction:join` / `auction:leave`; server emits `bid:placed` and `auction:ended`. Room joining is currently public by auction ID; only public auction information is emitted. Add per-user authenticated private rooms for account-specific notifications.

## Admin bootstrap
For security, registration always creates a buyer. Promote an account using a controlled database operation, not a public endpoint:

```js
// In a trusted one-off Node script after connecting to MongoDB:
await User.updateOne({ email: 'admin@your-domain.example' }, { $set: { role: 'admin' } });
```

Import `User` from `server/src/models/User.js`. Do not use a real production password in source control. A dedicated audited admin bootstrap command should be added for a production deployment.

## Build and tests
```bash
npm run build
npm test
```

The current automated test is a minimal contract smoke test. Expand it before submission to cover authentication, auction transitions, bid validation, transaction rollback, idempotency, and simultaneous bids. See `docs/ARCHITECTURE.md`.
