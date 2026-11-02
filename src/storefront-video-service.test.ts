import test from "node:test";
import assert from "node:assert/strict";
import { StorefrontVideoService } from "./storefront-video-service.ts";

test("a suspended storefront cannot open a customer checkout room", async () => {
  const calls: string[] = [];
  const client = { request: async <T>(method: string, path: string): Promise<T> => {
    calls.push(`${method} ${path}`);
    return {} as T;
  } };
  const service = new StorefrontVideoService(client as never);
  const input = { tenantId: "shop-1", accountId: "acct-1", customerId: "cust-1", roomName: "checkout-1", recordingKey: "checkout-1.webm" };
  service.onboardTenant(input);
  service.suspendAccount("acct-1");
  await assert.rejects(() => service.openCheckoutRoom(input), /suspended/);
  assert.deepEqual(calls, []);
});
