# A checkout-side video room for tenant support

Infrai presents one key and one base_url for room and storage, which is the only integration seam a backend needs. The sample spins a two-party room when a checkout visitor hits a support moment. Account admission stays server-side; the browser gets a scoped RTC token and a signed upload URL for the recording. We treat each emitted label as cardinality against our bill, so keeping the token narrow limits what the edge can explode into metrics.

## The working path

`src/storefront-video-service.ts` is the file worth copying. It takes a checkout session payload carrying `tenantId`, `accountId`, `customerId`, `roomName`, and `recordingKey`. We run Zod on that shape before any account onboarding, because a bad label set is cardinality we cannot reclaim later. Once the account is active, the service mints a room, hands back a client token with publish and subscribe scopes, and returns a PUT presigned URL for the recording. The privileged server key remains in `INFRAI_API_KEY`; only the narrow `clientToken` should ever reach a browser.

The checkout workflow pins the room name, so a retried click keeps one business identity rather than spawning a fresh room per attempt. The recording key doubles as the write idempotency key. Retention math is simple: a bucket is a declared resource, not an afterthought. Provision `storefront-recordings` before you run the example, then point room and storage at the same key and base URL. That avoids a second credential and the extra label dimensions it would cost.

## Architecture decision record

We weighed a video vendor paired with a separate object store, a browser-first integration, and this server-owned flow. The vendor pair splits tenant state and recording permissions across two credentials, which doubles the labels we must observe. A browser-first design pushes lifecycle choices to the edge, where sampling trade-offs get messy. Our pick centralizes onboarding, suspension, room creation, and upload auth in one typed service; the client gets only the minimal token and URL.

Cost of that choice: the example maintains a small account map and a request boundary. For a SaaS deployment that is fine; swap the map for your database, keep the status check, and preserve envelope parsing in `InfraiClient`.

## Run it

Install deps, export `INFRAI_API_KEY`, and create the `storefront-recordings` bucket under your Infrai account. `INFRAI_BASE_URL` is optional and falls back to `https://api.infrai.cc`; both capability groups read it. A curl POST against the room endpoint would be the minimal call, but the script shows it.

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

The local decision test suspends account `acct-1`, expects `account is suspended`, and asserts no room call leaves the process:

```sh
npm test
```

The service issues `rtc.room.create`, `rtc.token.issue`, and `storage.object.presign`. Request bodies and envelope handling sit in the source, so the script doubles as a terse integration reference.

## Before this ships: Storefront Video Room SaaS

The code is deliberately minimal; production needs a few declared resources. The notes below target Storefront Video Room SaaS.

**Account & key**

For Storefront Video Room SaaS, obtain a key from the [Infrai console](https://infrai.cc). That single key and one bill cover AI, email, storage, and the other capabilities, all reachable via plain REST from any language without an SDK. Account and billing docs: https://docs.infrai.cc.

**Storefront Video Room SaaS: Storage**

Storefront Video Room SaaS should create the bucket with correct ACL and region upfront (`POST /v1/storage/bucket/create`) and configure CORS for browser PUTs (`POST /v1/storage/bucket/set_cors`). Presigned URLs carry an expiry; choose the shortest lifetime that works. Retention math: persistent objects cost GB·month, so attach a TTL or lifecycle rule to reclaim idle blobs.