# Assumptions and Trade-offs

## 1. Design assumptions

- The platform supports buyers and administrators with separate permissions.
- Public registration creates buyer accounts; administrator access is provisioned through a controlled process.
- The server is authoritative for bid acceptance, auction status, prices, and deadlines.
- Auctions use the states `scheduled`, `live`, `ended`, and `cancelled`.
- MongoDB transactions are used for consistent bid updates and require replica-set support.
- Demo auction cards are fallback content and cannot accept bids.
- Vercel, Render, and MongoDB Atlas are proposed deployment choices, not evidence of a completed deployment.

## 2. Design trade-offs

| Decision | Benefit | Trade-off |
|---|---|---|
| React and Vite | Fast frontend development | Requires SPA fallback configuration for nested routes |
| Express REST API | Simple HTTP interface | Validation and error handling require consistent implementation |
| MongoDB transactions | Consistent bid and auction updates | Requires replica-set support and adds complexity |
| JWT in localStorage | Simple client integration | JavaScript-accessible tokens increase exposure if XSS occurs |
| Socket.IO | Real-time auction updates | Multi-instance deployment requires shared event delivery |
| Lifecycle poller | Simple auction state management | Multiple instances need coordination to avoid duplicate work |
| Image URLs | Simple listing images | No upload, storage, or image-processing pipeline |
| No payment integration | Keeps initial scope manageable | Payment, escrow, refunds, and settlement remain future work |

## 3. Known limitations

1. The lifecycle poller is designed for a single API instance; distributed coordination is needed before scaling.
2. Readiness checks should verify MongoDB connectivity before production.
3. Payment processing, escrow, identity verification, refunds, and dispute handling are outside the current scope.
4. Listings use image URLs rather than a complete upload pipeline.
5. The administrator interface requires completion and verification if a full management dashboard is expected.
6. Automated tests need broader integration, transaction, and concurrency coverage.
7. Demo listings are fallback content rather than database records.
8. Token storage uses localStorage in this implementation; a secure cookie-based design should be evaluated for public deployment.

## 4. Future improvements

- Complete the administrator dashboard and user moderation.
- Add distributed lifecycle scheduling and a Socket.IO adapter for multi-instance deployments.
- Expand authorization, idempotency, transaction rollback, and concurrent-bid tests.
- Add rate limiting, account recovery, audit logs, monitoring, and alerting.
- Add secure image uploads and object storage.
- Integrate payments and settlement with verified webhooks and reconciliation.
- Evaluate HttpOnly cookies with CSRF protection.
- Conduct load testing, security testing, and backup/restore drills.

## 5. Deployment assumptions

The proposed architecture uses Vercel for the frontend, Render for the API, and MongoDB Atlas for persistence. Production secrets must be stored in hosting-provider secret settings, and the frontend origin must match the API's CORS allowlist.

Actual deployment URLs and test results should be documented only after they have been verified.