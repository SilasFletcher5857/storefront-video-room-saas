import { z } from "zod";
import { InfraiClient } from "./infrai-client.ts";

const checkoutSession = z.object({
  tenantId: z.string().min(1),
  accountId: z.string().min(1),
  customerId: z.string().min(1),
  roomName: z.string().min(1),
  recordingKey: z.string().min(1)
});

export type CheckoutSession = z.infer<typeof checkoutSession>;

type Account = { tenantId: string; accountId: string; status: "active" | "suspended" };

export class StorefrontVideoService {
  private readonly accounts = new Map<string, Account>();
  private readonly infrai: InfraiClient;
  constructor(infrai: InfraiClient) {
    this.infrai = infrai;
  }

  onboardTenant(input: CheckoutSession): Account {
    const session = checkoutSession.parse(input);
    const account = { tenantId: session.tenantId, accountId: session.accountId, status: "active" as const };
    this.accounts.set(session.accountId, account);
    return account;
  }

  suspendAccount(accountId: string): void {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error("account must be onboarded first");
    account.status = "suspended";
  }

  async openCheckoutRoom(input: CheckoutSession) {
    const session = checkoutSession.parse(input);
    const account = this.accounts.get(session.accountId) ?? this.onboardTenant(session);
    if (account.status !== "active") throw new Error("account is suspended");
    // rtc.room.create is the room decision for an active checkout account.
    const room = await this.infrai.request<{ name: string }>("POST", "/v1/rtc/room/create", {
      name: session.roomName,
      max_participants: 2,
      empty_timeout_s: 900,
      region: "auto"
    });
    const token = await this.infrai.request<{ token: string }>("POST", "/v1/rtc/token/issue", {
      room: session.roomName,
      identity: session.customerId,
      display_name: "Storefront customer",
      ttl_s: 3600,
      can_publish: true,
      can_subscribe: true
    });
    const recording = await this.infrai.request<{ url: string }>("POST", `/v1/storage/object/presign/storefront-recordings/${encodeURIComponent(session.recordingKey)}`, {
      op: "put",
      expires_seconds: 900,
      content_type: "video/webm",
      max_bytes: 500000000,
      response_disposition: "attachment",
      idempotency_key: `${session.accountId}:${session.recordingKey}`
    });
    return { tenantId: session.tenantId, room, clientToken: token, recordingUploadUrl: recording };
  }
}
