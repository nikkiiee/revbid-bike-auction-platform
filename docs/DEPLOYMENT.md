# RevBid — Deployment Instructions

## 1. Deployment Architecture

RevBid uses the following deployment setup:

- **Frontend:** Vercel — React application built with Vite.
- **Backend:** Render — Node.js and Express API with Socket.IO.
- **Database:** MongoDB Atlas — managed MongoDB database.

## 2. Backend Deployment — Render

1. Connect the RevBid Git repository to Render and create a Web Service.
2. Set the root directory to `server`.
3. Configure the following commands:

**Build command**

```bash
npm install
```

**Start command**

```bash
npm start
```

These commands match the scripts in `server/package.json`.

Configure the following environment variables in the Render dashboard:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | Use the port provided by Render, if required by the application |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Strong, randomly generated secret |
| `JWT_EXPIRES_IN` | `1d`, if consistent with the application configuration |
| `CLIENT_ORIGIN` | Exact deployed Vercel frontend origin |
| `LOG_LEVEL` | `info` |

Deploy the service and verify that it starts successfully.

Check the health endpoints:

- `https://YOUR_RENDER_HOST/health/live`
- `https://YOUR_RENDER_HOST/health/ready`

Replace `YOUR_RENDER_HOST` with your actual Render hostname.

## 3. Database Setup — MongoDB Atlas

1. Create or select an Atlas cluster.
2. Create a database user with appropriate least-privilege access.
3. Configure network access to allow the backend to connect.
4. Add the Atlas connection string to Render as `MONGODB_URI`.
5. Ensure the deployment supports MongoDB transactions if required by the bidding implementation.
6. Verify that the required database indexes exist, including the unique bidder/idempotency-key index.
7. Enable backups and protect database credentials.

Never commit database credentials or production secrets to Git.

## 4. Frontend Deployment — Vercel

1. Import the RevBid repository into Vercel.
2. Set the project root directory to `client`.
3. Configure the build command as `npm run build`.
4. Set the output directory to `dist`.
5. Add these environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://YOUR_RENDER_HOST/api` |
| `VITE_SOCKET_URL` | `https://YOUR_RENDER_HOST` |

Replace `YOUR_RENDER_HOST` with the actual backend hostname.

Redeploy the frontend after changing environment variables because Vite embeds these values during the build.

Ensure that nested frontend routes are configured to serve `index.html`.

## 5. CORS and WebSocket Configuration

- Set `CLIENT_ORIGIN` to the exact deployed Vercel origin.
- Configure Express CORS to allow the intended frontend origin.
- Configure Socket.IO with the appropriate origin restrictions.
- Use HTTPS for production traffic.
- Verify that WebSocket connections work through the Render service.

## 6. Local Development

Run backend commands from the repository root:

```powershell
cd server
npm install
npm run dev
```

Run backend tests:

```powershell
cd server
npm test
```

Run the frontend in a separate terminal:

```powershell
cd client
npm install
npm run dev
```

The backend scripts defined in `server/package.json` are:

- `npm run dev` — runs `node --watch src/index.js`.
- `npm start` — runs `node src/index.js`.
- `npm test` — runs `node --test`.

## 7. Post-Deployment Verification

- [ ] Frontend loads successfully.
- [ ] Backend health endpoints respond as expected.
- [ ] Backend connects to MongoDB Atlas.
- [ ] Registration and login work.
- [ ] Buyer and administrator permissions are enforced.
- [ ] Auction listings load from the API.
- [ ] Bids are validated by the server.
- [ ] Transactional bidding and idempotency behavior are tested.
- [ ] Socket.IO events reach connected clients.
- [ ] Production logs are reviewed.
- [ ] Database indexes and backups are verified.

## 8. Demo Accounts and Security

Do not commit default administrator credentials to the repository. Create buyer accounts through the application and provision administrator access through a controlled process.

Store secrets in the hosting provider's environment configuration. Never expose `JWT_SECRET` or `MONGODB_URI` in frontend environment variables.

## 9. Known Production Considerations

A successful deployment does not by itself establish production readiness. Before operating at scale, review distributed lifecycle scheduling, multi-instance Socket.IO coordination, database-aware readiness checks, concurrent-bidding tests, monitoring, and backup restoration.