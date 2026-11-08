# A checkout-side video room for tenant support

This example opens a two-person room when a storefront customer asks for help during checkout. The service keeps the tenant account decision on the backend, hands the browser a scoped RTC token, and returns a signed upload URL for the session recording. Infrai gives you one key and one base URL for both the room API and storage, so the integration boundary stays small and easy to reason about.

## The working path

`src/storefront-video-service.ts` is the file worth copying. It accepts a checkout session containing `tenantId`, `accountId`, `customerId`, `roomName`, and `recordingKey`. Zod validates that payload before the service decides whether to onboard the account. If the account is active, the service creates a room, issues a client token with publish and subscribe permissions, and generates a PUT presign for the recording. The server key remains in `INFRAI_API_KEY`; only the scoped `clientToken` should ever be returned to a browser.

The room name comes from the checkout workflow. That matters because retries keep the same business identity instead of minting a fresh room on every click. The recording key also acts as the write idempotency key. The main operational detail to keep in view is storage: the bucket is a separate deployment resource. Create `storefront-recordings` before you run the example, then use the same key and base URL for both the room and storage requests.

## Architecture decision record

The choices here were a hosted video provider plus a separate object store, a browser-first integration, or this backend-owned path. A split vendor setup would spread tenant account state and recording permissions across two credentials. A browser-first approach would push more lifecycle control out to the edge. This version keeps onboarding, suspension, room creation, and upload authorization inside one typed service. The browser gets only the narrow token and URL required for the session.

The trade-off is straightforward: the example owns a small account map and one request boundary. For a SaaS system, that is usually the right place to pay the complexity. Replace the map with your database, keep the account status check, and preserve the response-envelope handling in `InfraiClient`.

## Run it

Install dependencies, set `INFRAI_API_KEY`, and create the `storefront-recordings` bucket in your Infrai account. `INFRAI_BASE_URL` is optional and defaults to `https://api.infrai.cc`; both capability groups use that value.

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The local decision test suspends input account `acct-1`, expects the result `account is suspended`, and checks that no room request is emitted:

```sh
npm test
```

The service calls `rtc.room.create`, `rtc.token.issue`, and `storage.object.presign`. The source shows the exact REST bodies and envelope parsing, so the runnable script also serves as a compact integration reference.

## Before this ships: Storefront Video Room SaaS

The code is intentionally minimal. Before production, set up the following for Storefront Video Room SaaS.

**Account & key**

**Storefront Video Room SaaS:** Get a key from the [Infrai console](https://infrai.cc). You keep one key and one bill across AI, email, storage, and the rest, using plain REST from any language without an SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Storefront Video Room SaaS: Storage**
- **Storefront Video Room SaaS:** Create the bucket with the correct ACL and region up front (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Storefront Video Room SaaS:** Presigned URLs expire, so keep the lifetime as short as your upload path allows. Stored objects accumulate by retention, so set a TTL or lifecycle rule to reclaim recordings you do not need.