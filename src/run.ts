import { InfraiClient } from "./infrai-client.ts";
import { StorefrontVideoService } from "./storefront-video-service.ts";

const service = new StorefrontVideoService(new InfraiClient());
const input = {
  tenantId: process.env.TENANT_ID ?? "demo-shop",
  accountId: process.env.ACCOUNT_ID ?? "demo-shop-account",
  customerId: process.env.CUSTOMER_ID ?? "customer-42",
  roomName: process.env.ROOM_NAME ?? "demo-shop-checkout",
  recordingKey: process.env.RECORDING_KEY ?? "demo-shop-checkout.webm"
};

const result = await service.openCheckoutRoom(input);
console.log(JSON.stringify({ room: result.room, clientToken: "issued", recordingUploadUrl: "presigned" }, null, 2));
