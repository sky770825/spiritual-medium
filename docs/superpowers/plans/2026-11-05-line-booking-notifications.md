# LINE Booking Identity and Review Notifications Implementation Plan

Goal: verified LINE identity on new bookings, official-account review result messages, observable recoverable delivery.
Architecture: LIFF supplies an ID token only with explicit consent; API verifies it against LINE channel before deriving sub. Tokens never persist. Server stores verified userId and consent, never trusts client userId. Optional manual bookings remain clearly unbound. CAS-persisted notification event, stable retry UUID, sending lease, no external calls inside CAS mutations; retries reuse key, accepted is not read/delivery proof. Approval and cancellation persist before dispatch; failure never rolls back booking. Concurrent status changes while a notification is sending are rejected briefly. Old records require manual contact.
Tech: existing Node/Vercel Blob/LIFF/Messaging API.

- [x] Tests first: forged/expired/wrong channel tokens, consent, identity mismatch on request replay; approval/cancellation event persistence, concurrent sends, retry UUID, ambiguous network failure, legacy and missing config.
- [x] Implement server/booking-line.js and notification queue/service; integrate booking and admin APIs.
- [x] Add explicit customer identity consent/login UI, privacy update, admin verified identity and notification state/retry.
- [ ] Browser desktop/mobile QA with local demo; no real customer test sends. Run tests, independent review, deploy and verify endpoints/assets.
- [ ] Configure channel ID, check bot token configuration, publish only with pending platform confirmation; update menu only if published. Real phone delivery cannot be claimed without observation.

Verification: 27 tests pass; independent review clear after stale-notification fix. Production dpl_24aoyqpjmfCjpmvS85tuLQQD1aoy READY. Formal invalid ID token 401, unauthenticated retry401, static assets match local, admin health401 fromLINE. No test records sent to real customers. Application publish and credential binding confirmation pending.

2026-11-05 follow-up: user authorized execution. Published LINE channel, secured existing bot token in production Vercel sensitive env, deployed dpl_bTvHadthmkSoQX5F6iJEWXPdMfzY, production line-health ready, menu links toLIFF. Real mobile customer receipt still unobserved.
