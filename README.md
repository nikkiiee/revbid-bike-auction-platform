# RevBid — Bike Auction Platform

RevBid is a full-stack web application for auctions of used motorcycles. It enables registered buyers to browse motorcycle listings, participate in live auctions, and place bids in real time. Administrators have separate permissions for auction management.

The project demonstrates full-stack development, authentication and authorization, REST API design, database transactions, real-time communication, auction lifecycle management, automated testing, and deployment.

> **Project status:** RevBid is a deployed implementation baseline with core buyer and bidding workflows. It is not yet a fully audited production service. Known limitations and future improvements are documented below and in the architecture documentation.

## Live Demo

- **Frontend:** https://revbid-bike-auction-platform.vercel.app/
- **Backend API:** https://revbid-api-9s06.onrender.com
- **Administrator interface:** https://revbid-bike-auction-platform.vercel.app/admin

The frontend is hosted on Vercel, the backend API on Render, and the database on MongoDB Atlas.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Data access | Mongoose |
| Authentication | JSON Web Tokens (JWT) |
| Real-time communication | Socket.IO |
| API validation | Server-side input validation |
| Logging | Structured application logs |
| Testing | Node.js test runner and project test suite |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Database hosting | MongoDB Atlas |

## Features

### Buyer functionality

- Register and log in using authenticated accounts.
- Browse motorcycle auction listings.
- Search and filter auctions.
- View auction details, current prices, deadlines, and recent bids.
- Place bids on eligible auctions.
- Receive real-time bid and auction status updates.
- View the current auction state and bidding information.

### Auction management

- Support multiple auctions with independent start and end times.
- Manage the auction states: `scheduled`, `live`, `ended`, and `cancelled`.
- Validate bids on the backend.
- Enforce minimum bid increments.
- Prevent users from bidding on their own auctions.
- Reject bids when an auction is not open for bidding.
- Use MongoDB transactions for bid-related consistency where supported by the configured database deployment.
- Support idempotency keys for duplicate-request protection where implemented by the API.

### Administrator functionality

- Restrict auction creation and administrative operations to authorized administrators.
- Prevent ordinary buyer accounts from accessing administrator-only API endpoints.
- Support cancellation of eligible auctions without bids.
- Provision administrator roles through a controlled process rather than public registration.

### Operational features

- Health endpoints for application checks.
- Structured backend logs.
- Environment-based configuration.
- Real-time event delivery through Socket.IO.
- Automated tests for selected API and business-rule behavior.

## Repository Structure

The project is organized into a frontend client, backend server, and documentation.

```text
revbid-bike-auction-platform/
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vercel.json
├── server/
│   ├── src/
│   ├── scripts/
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── ASSUMPTIONS-AND-TRADEOFFS.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

The exact contents of individual folders may evolve as the project develops.

## Requirements

- Node.js 20 or later.
- npm.
- MongoDB 6 or later, configured as a replica set for transaction-dependent bidding.
- Git.
- A modern web browser.

A MongoDB Atlas deployment can be used instead of a local MongoDB replica set.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/nikkiiee/revbid-bike-auction-platform.git
cd revbid-bike-auction-platform
```

### 2. Configure environment variables

Create a local environment file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and configure the required values, including:

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/bike_auction?replicaSet=rs0
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
LOG_LEVEL=info
```

Use the variable names and additional settings defined in `.env.example` as the source of truth for your checkout. Never commit `.env`, production secrets, database credentials, or real user passwords.

For MongoDB Atlas, use your own connection string and ensure the database user and network access configuration are correct.

### 3. Install dependencies

From the repository root:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 4. Start the application

```bash
npm run dev
```

If the root development script is unavailable in your checkout, start the backend and frontend in separate terminals using the scripts defined in `server/package.json` and `client/package.json`.

### 5. Open the application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Liveness endpoint:** http://localhost:5000/health/live
- **Readiness endpoint:** http://localhost:5000/health/ready

The liveness endpoint checks whether the API process is responding. Readiness behavior depends on the implementation of the endpoint and should be verified against database connectivity requirements.

### MongoDB transaction requirement

Bid placement uses MongoDB transactions. MongoDB must run as a replica set; a standalone MongoDB instance does not support the transaction workflow required by this implementation.

A single-node replica set can be sufficient for local development. For example:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/bike_auction?replicaSet=rs0
```

Configure and initialize the local replica set before testing transaction-dependent features.

## Environment Variables

See `.env.example` for the complete list of supported variables.

Important configuration values include:

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `NODE_ENV` | Runtime environment |
| `CLIENT_ORIGIN` | Allowed frontend origin for cross-origin requests |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign and verify authentication tokens |
| `JWT_EXPIRES_IN` | Authentication token lifetime |
| `LOG_LEVEL` | Application logging verbosity |
| `VITE_API_URL` | Frontend API base URL, including `/api` |
| `VITE_SOCKET_URL` | Backend origin used for Socket.IO |

For local development, the frontend environment variables typically point to the local API. For deployment, use the hosting provider's environment settings.

Example production frontend configuration:

```dotenv
VITE_API_URL=https://revbid-api-9s06.onrender.com/api
VITE_SOCKET_URL=https://revbid-api-9s06.onrender.com
```

Set `CLIENT_ORIGIN` on the backend to the exact deployed frontend origin. Do not include an API path in `CLIENT_ORIGIN`.

## API Overview

The following endpoints describe the main application interface. Request validation, authentication, authorization, and error responses are enforced according to each route's implementation.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Register a buyer account |
| `POST` | `/api/auth/login` | Authenticate a user and receive a JWT |
| `GET` | `/api/auth/me` | Retrieve the authenticated user's information |

### Auctions

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/auctions` | List and search auctions |
| `GET` | `/api/auctions/:id` | Retrieve auction details |
| `GET` | `/api/auctions/:id/bids` | Retrieve bid history |
| `POST` | `/api/auctions/:id/bids` | Place a bid |
| `POST` | `/api/auctions` | Create an auction; administrator access required |
| `PATCH` | `/api/auctions/:id/cancel` | Cancel an eligible auction; administrator access required |

Example auction listing request:

```http
GET /api/auctions?page=1&limit=12&status=live&q=honda
```

Example bid request:

```json
{
  "amount": 123000,
  "idempotencyKey": "a-unique-key-123"
}
```

Send the bid request to:

```text
POST /api/auctions/:id/bids
```

Authenticated endpoints require the appropriate authentication header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

The backend remains authoritative for bid acceptance, auction status, permissions, and prices. Clients must not assume a bid is accepted until the API confirms it.

### Health endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health/live` | Check whether the application process is responding |
| `GET` | `/health/ready` | Check application readiness according to the implemented readiness logic |

## Real-Time Communication

Socket.IO provides real-time auction updates.

The client uses the following events:

- `auction:join` — join an auction room.
- `auction:leave` — leave an auction room.

The server emits events including:

- `bid:placed` — notify connected clients about a successfully placed bid.
- `auction:ended` — notify clients when an auction ends.

Real-time events are intended to keep connected clients updated. The API and persisted database state remain authoritative.

Room joining is based on auction IDs in the current design. Only public auction information should be broadcast through public auction rooms. Private account-specific notifications would require authenticated private rooms and appropriate access controls.

## Administrator Access

Public registration creates buyer accounts. Administrator privileges must be assigned through a controlled process.

For local development or a trusted administrative operation, an existing user can be promoted through a restricted database script. For example, using the project's `User` model after connecting to the intended database:

```javascript
await User.updateOne(
  { email: "admin@your-domain.example" },
  { $set: { role: "admin" } }
);
```

The `User` model is located at:

```text
server/src/models/User.js
```

This snippet is an illustrative administrative operation, not a public API endpoint. Run it only in a trusted environment, confirm that the target account exists, and verify the resulting role. A dedicated, audited administrator provisioning command is preferable for production.

Never commit administrator passwords, JWT secrets, or database credentials to source control.

## Build and Tests

From the repository root, run:

```bash
npm test
npm run build
```

If a script is not available at the root, use the scripts defined in the respective package files. For example:

```bash
npm test --prefix server
npm run build --prefix client
```

Use the commands supported by the actual `package.json` files in your checkout.

The project has undergone automated and manual validation of selected authentication, authorization, auction lifecycle, and bidding workflows. Previously observed checks included:

- Buyer authentication.
- Rejection of unauthorized auction creation.
- Prevention of self-bidding.
- Acceptance of valid bids.
- Rejection of bids that violate auction lifecycle rules.
- Auction listing and detail retrieval.
- Health endpoint responses.

The exact test coverage can change as the code evolves. Run the test suite before submitting and report the current results rather than relying on historical results.

### Further testing recommended

Before a public launch, extend the automated suite to cover:

- Concurrent bids on the same auction.
- Transaction rollback and database failures.
- Idempotency and duplicate bid requests.
- Auction start and end boundary conditions.
- Authentication expiry and authorization failures.
- Input validation and malformed requests.
- Multi-instance lifecycle coordination.
- Load, security, and end-to-end user workflows.

## Deployment

The current deployment uses:

- **Vercel** for the React/Vite frontend.
- **Render** for the Express API.
- **MongoDB Atlas** for database persistence.

### Frontend deployment

Configure Vercel with:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

Configure `VITE_API_URL` and `VITE_SOCKET_URL` in the Vercel project environment settings. Redeploy after changing build-time environment variables.

The frontend uses SPA fallback configuration so nested client-side routes can resolve correctly.

### Backend deployment

Configure the Render service with the correct backend root directory, build command, and start command according to the server package scripts.

Set the required environment variables in Render, including:

- `NODE_ENV`
- `PORT`, where required by the hosting configuration
- `CLIENT_ORIGIN`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `LOG_LEVEL`

Use a strong secret and a production MongoDB connection string. Never put secret values in this README.

### MongoDB Atlas

Ensure that:

- A database user with appropriate permissions exists.
- Network access allows the deployed API to connect.
- The configured deployment supports MongoDB transactions.
- Database credentials are stored securely.
- Access is not left open to every IP address without a justified requirement.

### Post-deployment checks

After deployment:

1. Open the frontend and verify that the application loads.
2. Check the backend liveness endpoint.
3. Check the readiness endpoint and confirm what dependencies it validates.
4. Register or log in with a test buyer account.
5. Verify that auctions load from the API.
6. Test a valid bid and an invalid bid.
7. Confirm that self-bidding and unauthorized administrator actions are rejected.
8. Check Render logs for database connectivity errors and unexpected server failures.
9. Confirm that the frontend and backend environment settings match.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the deployment procedure and configuration details.

## Architecture and Design

The application separates the React frontend from the Express API and MongoDB persistence layer.

The API handles authentication, authorization, validation, auction business rules, and bid processing. Socket.IO provides live updates to connected clients, while the database stores auction and bid information.

The server is the source of truth for auction prices and deadlines. The frontend displays state and submits requests but must not determine whether a bid is valid.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture, component responsibilities, data flow, and hardening considerations.

## Assumptions and Trade-offs

The implementation makes the following design choices:

- Buyers and administrators have separate permissions.
- Public registration creates buyer accounts.
- The backend is authoritative for bidding and auction lifecycle decisions.
- MongoDB transactions require replica-set support.
- Socket.IO enables real-time updates, but multi-instance deployments require shared event delivery.
- The lifecycle worker needs coordination before being scaled across multiple API instances.
- Image URLs are used instead of a complete upload and processing pipeline.
- Payment processing, escrow, settlement, refunds, and dispute management are outside the current scope.

These choices keep the initial implementation focused while identifying areas that require further work.

See [docs/ASSUMPTIONS-AND-TRADEOFFS.md](docs/ASSUMPTIONS-AND-TRADEOFFS.md) for more details.

## Known Limitations and Future Improvements

RevBid is a project implementation baseline, not a claim of complete production readiness.

Areas for improvement include:

- Distributed auction lifecycle scheduling and coordination.
- Shared Socket.IO event delivery for multiple API instances.
- Expanded transaction, rollback, idempotency, and concurrency tests.
- Rate limiting, account recovery, and security hardening.
- Auditing, monitoring, metrics, and alerting.
- Secure image uploads and object storage.
- Payment integration with verified webhooks and reconciliation.
- Further administrator management and user moderation capabilities, depending on the required workflow.
- Load testing, security testing, and backup/restore drills.

Features that are not implemented and verified should not be represented as complete.

## Security Notes

- Store secrets in environment variables or hosting-provider secret settings.
- Never commit `.env` files, JWT secrets, database credentials, or real passwords.
- Enforce permissions on the backend rather than relying only on frontend visibility.
- Validate all client input on the server.
- Restrict database network access to the required sources.
- Review token storage and consider an HttpOnly-cookie approach with appropriate CSRF protection for a public-facing deployment.
- Use dedicated test accounts and a separate test database for integration tests.

## Demo Access

No demo credentials are included in this README.

For evaluation, provide a dedicated test buyer account and, if administrator access is required, a dedicated demo administrator account through the designated private submission channel. Verify both accounts before sharing them. Do not share production credentials.

## License

Add a `LICENSE` file if the project is intended to be distributed under an open-source license. Until a license is selected and included in the repository, no particular open-source license is implied.