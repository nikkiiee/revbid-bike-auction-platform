# RevBid — Assumptions and Trade-offs

## 1. Design Assumptions

- The platform supports buyers and administrators with separate permissions.
- Public registration creates buyer accounts; administrator access is provisioned through a controlled process.
- The server is authoritative for bid acceptance, auction status, prices, and deadlines.
- Auctions use the states `scheduled`, `live`, `ended`, and `cancelled`.
- MongoDB transactions are used for consistent bid updates and require replica-set support or a supported sharded deployment.
- Demo auction cards are fallback content and cannot accept bids.
- The application is deployed using Vercel for the frontend, Render for the backend API, and MongoDB Atlas for persistence.
- Production secrets are stored in hosting-provider environment settings rather than committed to source control.

## 2. Design Trade-offs

| Decision | Benefit | Trade-off |
|---|---|---|
| React and Vite | Fast frontend development and efficient builds | Requires SPA fallback configuration for nested routes |
| Express REST API | Simple interface between the frontend and backend | Validation and error handling must be implemented consistently |
| MongoDB transactions | Helps maintain consistency between bid records and auction updates | Requires replica-set or supported sharded deployment and adds operational complexity |
| JWT in localStorage | Simple client-side authentication integration | JavaScript-accessible tokens may be exposed if an XSS vulnerability exists |
| Socket.IO | Enables real-time auction updates for connected buyers | Multi-instance deployment requires shared event delivery |
| Lifecycle poller | Simple auction state management | Multiple backend instances require coordination to avoid duplicate processing |
| Image URLs | Simple way to display motorcycle images | No complete upload, storage, or image-processing pipeline |
| No payment integration | Keeps the initial implementation focused on auction functionality | Payment processing, escrow, refunds, and settlement remain outside the current scope |

## 3. Known Limitations

1. **Lifecycle coordination:** The lifecycle worker is designed for a single API instance. Distributed coordination is needed before safely scaling the worker across multiple instances.
2. **Observability:** Health endpoints and structured logs support operational checks, but they do not replace metrics, alerting, distributed tracing, or comprehensive dependency monitoring.
3. **Payments and identity:** Payment processing, escrow, identity verification, refunds, and dispute handling are outside the current scope.
4. **Image handling:** Listings use image URLs rather than a complete secure upload and storage pipeline.
5. **Administrator interface:** The administrator interface must be verified against the required management workflows. Any missing functionality should be completed before claiming full administrative management support.
6. **Automated testing:** Broader integration, transaction rollback, idempotency, and concurrent-bidding tests are needed before a public production launch.
7. **Demo listings:** Demo listings may be fallback content rather than database records and cannot accept bids.
8. **Token storage:** The current implementation uses browser `localStorage` for JWT persistence. Because JavaScript can access this storage, an XSS vulnerability could expose a token. A more hardened public deployment should evaluate HttpOnly cookies with appropriate Secure, SameSite, and CSRF protections.

## 4. Future Improvements

- Complete and verify the administrator dashboard and user moderation workflows.
- Add distributed lifecycle scheduling or coordinated job claiming for multi-instance deployments.
- Configure a shared Socket.IO adapter for real-time event delivery across backend instances.
- Expand authorization, idempotency, transaction rollback, and concurrent-bidding tests.
- Verify rate limiting and add account recovery, audit logs, monitoring, and alerting.
- Implement secure image uploads and object storage.
- Integrate payments and settlement using verified webhooks and reconciliation.
- Evaluate HttpOnly cookies with appropriate CSRF protection.
- Conduct load testing, security testing, and backup-and-restore drills.
- Improve dependency health checks and operational monitoring as reliability requirements increase.

## 5. Deployment Configuration

The application is deployed using the following services:

- **Frontend:** Vercel — React and Vite application.
- **Backend:** Render — Node.js and Express API with Socket.IO.
- **Database:** MongoDB Atlas — managed MongoDB persistence.

The frontend origin must match the backend CORS configuration. Production secrets, including database credentials and JWT signing secrets, must be stored securely in the hosting provider's environment settings.

The deployed application URLs are:

- **Frontend:** https://revbid-bike-auction-platform.vercel.app/
- **Backend API:** https://revbid-api-9s06.onrender.com
- **Administrator interface:** https://revbid-bike-auction-platform.vercel.app/admin

These URLs identify the configured deployment. Their current availability and individual workflows should be verified before submission.

## 6. Engineering Validation

Engineering claims should be supported by implementation evidence, automated tests, or deployment checks.

The project has undergone testing of selected authentication, authorization, auction lifecycle, and bidding workflows. These checks do not constitute a complete security audit or proof of production-scale reliability.

Before a public production launch, additional validation should cover:

- Concurrent bids and transaction rollback.
- Duplicate requests and idempotency behavior.
- Auction start and end boundary conditions.
- Buyer and administrator authorization.
- Database failures and recovery.
- Rate-limiting behavior.
- Multi-instance lifecycle coordination and Socket.IO event delivery.
- Load, security, and backup-recovery testing.

Features that have not been implemented or verified must be documented as limitations or future improvements rather than presented as completed capabilities.