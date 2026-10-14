# Engineering Decisions and Trade-offs

## 1. MongoDB Transactions and Bid Consistency

### Decision

MongoDB is used to persist auction and bid information. Bid placement uses a MongoDB transaction because accepting a bid involves related changes that must remain consistent.

### Bid processing flow

1. The client submits a bid request to the Express API.
2. Authentication middleware identifies the user.
3. The server validates the bid amount, auction status, auction start and end times, minimum increment, and self-bidding restrictions.
4. The server starts a MongoDB transaction.
5. Within the transaction, the auction update is conditioned on the relevant bidding rules and current auction state.
6. The bid record is inserted as part of the same transaction.
7. The transaction commits only when the related database operations succeed.
8. After successful persistence, the server emits the appropriate real-time bid update to connected clients.

If a transaction fails, the related database changes should be rolled back rather than leaving an accepted bid without its corresponding auction update.

### Concurrent bidding

Two buyers may attempt to bid on the same auction at nearly the same time. Server-side validation alone is not sufficient to prevent race conditions because the auction may change between reading its current price and updating it.

Conditional database updates and transaction handling help preserve consistency. Duplicate-request protection is supported through idempotency keys where implemented by the bid endpoint.

### Trade-offs and limitations

- MongoDB transactions require a replica-set deployment or a supported sharded deployment; a standalone MongoDB server is insufficient.
- Transactions add database overhead and require correct handling of transient failures and retries.
- Transaction correctness does not eliminate the need for concurrency testing.
- The transaction and idempotency behavior should be tested against the actual database configuration, including simultaneous bids, duplicate requests, and rollback scenarios.

## 2. Socket.IO and Real-Time Updates

### Decision

Socket.IO is used to deliver auction updates to connected clients without requiring the browser to repeatedly refresh the auction page.

### Event flow

1. A buyer opens an auction page.
2. The frontend establishes a Socket.IO connection and joins the relevant auction room.
3. The buyer submits a bid through the REST API.
4. The backend validates and persists the bid.
5. Following successful persistence, the server emits a `bid:placed` event to the relevant connected clients.
6. When an auction ends, the server can emit an `auction:ended` event to notify connected clients.

The REST API and database remain authoritative. A Socket.IO event is a notification of a state change, not proof by itself that a bid was accepted.

### Security considerations

Public auction rooms should carry only information intended to be visible to other participants. Account-specific or sensitive notifications require authenticated private rooms and explicit authorization.

### Trade-offs and limitations

- Socket.IO maintains connections and introduces additional resource and operational requirements.
- Disconnected clients can miss live events and should refresh or retrieve the latest auction state through the API.
- In a multi-instance deployment, clients connected to different backend instances need shared event delivery, such as a suitable Socket.IO adapter backed by Redis.
- A shared adapter handles event distribution but does not, by itself, solve database concurrency or distributed auction scheduling.

## 3. Role-Based Access Control

### Decision

RevBid separates buyer and administrator permissions using role-based access control (RBAC).

Public registration creates buyer accounts. Administrator privileges are assigned through a controlled provisioning process rather than being selectable during registration.

### Enforcement

Authentication establishes the identity of the requesting user. Authorization then checks whether that user has the required role for a protected operation.

Examples include:

- Buyers can browse auctions and place eligible bids.
- Buyers cannot create auctions through administrator-only endpoints.
- Administrators can access permitted auction management operations.
- Cancellation is restricted to auctions that satisfy the applicable business rules.

Authorization is enforced by the backend, not merely by hiding buttons or pages in the frontend.

### Trade-offs and limitations

- Role checks must be applied consistently to every protected route.
- Authentication alone does not grant administrative permissions.
- Role changes and administrator provisioning must be performed through trusted procedures.
- Further testing should cover unauthenticated requests, buyer access to administrator endpoints, invalid tokens, and permitted administrator operations.

## 4. Auction Lifecycle Management

### Decision

Auctions use explicit lifecycle states:

- `scheduled` — the auction has not started.
- `live` — the auction is open for eligible bids.
- `ended` — the auction has finished.
- `cancelled` — the auction has been cancelled under the applicable business rules.

The backend determines auction eligibility using persisted timestamps and server-side rules rather than trusting the browser clock.

### Lifecycle processing

The lifecycle worker periodically evaluates auctions against their configured start and end times. Eligible scheduled auctions can transition to `live`, while live auctions whose deadlines have passed can transition to `ended`.

Bid placement independently checks the auction state and time boundaries. This is important because a background worker may not update a status at the exact instant an auction starts or ends.

### Trade-offs and limitations

The current lifecycle worker is designed for a single API process. It must not be treated as a distributed scheduler.

Running multiple independent copies without coordination can cause duplicate processing and inconsistent operational behavior. Before horizontal scaling, lifecycle work needs a coordinated design, such as distributed locking, atomic claiming, or a dedicated scheduler with appropriate idempotency.

Additional tests should cover start and end boundaries, delayed worker execution, process restarts, and competing lifecycle workers.

## 5. Observability: Health Endpoints and Structured Logs

### Decision

RevBid exposes health endpoints and uses structured application logs to support troubleshooting and deployment verification.

### Health endpoints

- `GET /health/live` indicates whether the API process is responding.
- `GET /health/ready` reports readiness according to the endpoint's implemented checks.

These endpoints serve different purposes. Liveness helps determine whether the process is responding, while readiness should establish whether the dependencies required to serve requests are available.

### Structured logs

Structured logs help operators investigate API activity, request failures, database errors, and application behavior. They can support diagnosis by recording relevant event details and error context.

Logs must not contain passwords, JWT secrets, database connection credentials, or other sensitive information.

### What these signals do not guarantee

- A successful liveness response does not prove that MongoDB is available.
- A successful readiness response proves only what the readiness implementation actually checks.
- A successful HTTP response does not establish that every business rule works correctly.
- Logs are not a replacement for metrics, alerting, distributed tracing, or automated tests.
- Health endpoints do not prove that the system can withstand production traffic.

A production deployment should add appropriate dependency checks, metrics, alerts, request correlation, and operational dashboards according to its reliability requirements.

## 6. Scalability and Multi-Instance Deployment

### Current design

The application separates the frontend, REST API, database, real-time communication, and lifecycle processing. This supports a clear separation of responsibilities and allows the components to be developed and deployed independently.

### Current limitations

The current lifecycle worker is designed for a single API instance. Running multiple API instances without lifecycle coordination may cause duplicate processing.

Socket.IO connections are associated with backend instances. Without shared event delivery, a bid accepted by one instance may not automatically produce an event for clients connected to another instance.

MongoDB transactions help preserve database consistency, but they do not coordinate lifecycle workers or distribute Socket.IO events.

### Improvements required before horizontal scaling

- Introduce coordinated lifecycle scheduling or atomic job claiming.
- Configure a shared Socket.IO adapter or equivalent event-distribution mechanism.
- Review connection management, retry behavior, and failure recovery.
- Load-test concurrent bids against the intended MongoDB topology.
- Add metrics and alerts for failed requests, database errors, event delivery, and lifecycle processing.

Horizontal scaling should be considered validated only after these behaviors have been tested in a multi-instance environment.

## 7. Security Decisions

### Authentication

JWT-based authentication is used to identify authenticated users. Protected API endpoints must verify the token and reject missing, invalid, or expired credentials as appropriate.

### Input validation

The backend validates client input and applies business rules before accepting operations. Client-side validation improves usability but cannot replace server-side validation.

Bid amounts, auction identifiers, lifecycle conditions, and permissions must be checked by the API.

### Environment variables and secrets

Sensitive configuration, including `MONGODB_URI` and `JWT_SECRET`, belongs in local environment files or hosting-provider secret settings. These values must not be committed to source control or exposed through frontend build variables.

Only non-sensitive configuration intended for the browser should use frontend-exposed environment variables such as `VITE_API_URL` and `VITE_SOCKET_URL`.

### MongoDB Atlas network access

Atlas network access is restricted to the configured sources required by the deployment. Broad network access should not be enabled merely to avoid diagnosing connection problems.

Database credentials should follow least-privilege principles, and database connectivity errors should be investigated through application and database logs.

### Rate limiting and request protection

Rate limiting helps reduce abuse of sensitive endpoints, including authentication and other resource-intensive operations. Its effectiveness depends on the actual middleware configuration, limits, and deployment topology.

The deployed configuration should be verified rather than assuming that rate limiting is effective simply because the application includes related dependencies or middleware.

### Token storage

The current frontend uses browser local storage for JWT persistence. This is straightforward to integrate but makes tokens accessible to JavaScript running on the page. A cross-site scripting vulnerability could therefore expose a stored token.

A hardened public deployment should evaluate HttpOnly cookies with appropriate Secure and SameSite attributes and CSRF protection where required.

### Security limitations

The current implementation should undergo additional security testing before a public launch. Areas for review include token handling, authorization coverage, rate limiting, request validation, secret management, dependency vulnerabilities, and sensitive-data exposure in logs.

## 8. Engineering Validation

Engineering claims should be supported by code, automated tests, or deployment checks.

The project has undergone testing of selected authentication, authorization, auction lifecycle, and bidding workflows. These checks provide useful evidence for the implemented behavior but do not constitute a complete security audit or production scalability assessment.

Further validation should include:

- Concurrent bidding and transaction rollback tests.
- Idempotency and duplicate-request tests.
- Lifecycle boundary and multi-worker tests.
- Authorization tests for buyer and administrator roles.
- Database failure and recovery tests.
- Rate-limit verification.
- Multi-instance Socket.IO event-delivery tests.
- Load, security, and backup-recovery testing.

