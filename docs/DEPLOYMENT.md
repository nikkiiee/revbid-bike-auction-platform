# Deployment instructions

## Frontend (Vercel or Netlify)
1. Import the repository and set the project root to `client`.
2. Build command: `npm run build`; output directory: `dist`.
3. Set `VITE_API_URL=https://YOUR_API_HOST/api` and `VITE_SOCKET_URL=https://YOUR_API_HOST` as build-time variables.
4. Configure SPA fallback so nested routes return `index.html`.

## Backend (Render, Railway, Fly.io, or container host)
1. Set service root to repository root or build from `Dockerfile.server`.
2. Install: `npm install --prefix server`; start: `npm start --prefix server` (or use the Dockerfile).
3. Set `PORT`, `NODE_ENV=production`, `MONGODB_URI`, a cryptographically random `JWT_SECRET`, `JWT_EXPIRES_IN`, exact `CLIENT_ORIGIN`, and `LOG_LEVEL`.
4. Ensure the platform supports persistent WebSocket connections and forwards the service port.
5. Configure `/health/live` as the liveness check and `/health/ready` as readiness after improving readiness to ping MongoDB.

## Database
Use MongoDB Atlas or another managed replica-set deployment. Restrict network access, create a least-privilege database user, enable backups, and verify transaction support. Do not expose the database publicly.

## Demo login credentials
No public deployment has been created by this source-generation step, so no live URL or working credentials exist yet. After deploying, create a buyer account through the UI and promote a separate account to `admin` using the controlled database procedure in the README. Never ship shared default admin credentials.

## Release checklist
- [ ] Set production secrets in host secret storage; rotate any development secrets.
- [ ] Confirm CORS and frontend URLs match exactly.
- [ ] Test websocket events through the deployed proxy.
- [ ] Run auth, bidding, idempotency, and concurrent-bid integration tests.
- [ ] Add distributed lifecycle scheduling and Socket.IO adapter for multiple replicas.
- [ ] Add error/latency metrics, alerting, and database backup verification.
- [ ] Create demo users with least privilege and document credentials in the submission portal only.
