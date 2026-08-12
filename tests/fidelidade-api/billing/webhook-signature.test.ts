import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { constructWebhookEvent } from "../../../apps/fidelidade-api/src/billing/stripe-client";

/**
 * The RAW-BODY test. `constructEvent` HMACs the exact bytes Stripe signed, so
 * this is what catches anyone who "helpfully" parses the request body before the
 * webhook route reads it: re-serialising JSON reorders nothing visible but does
 * change the bytes, and every delivery would then be rejected in production
 * while every mocked test kept passing.
 *
 * Nothing here touches the network — `webhooks.constructEvent` is pure crypto.
 */

const WEBHOOK_SECRET = "whsec_unit_test_secret";

const PAYLOAD = JSON.stringify({
  id: "evt_raw_body",
  object: "event",
  type: "customer.subscription.updated",
  data: { object: { id: "sub_123", status: "active" } },
});

function signatureFor(payload: string, timestamp?: number): string {
  return new Stripe("sk_test_unit").webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
    ...(timestamp === undefined ? {} : { timestamp }),
  });
}

describe("stripe webhook signature", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a payload signed with the configured secret", () => {
    const event = constructWebhookEvent(PAYLOAD, signatureFor(PAYLOAD));

    expect(event.id).toBe("evt_raw_body");
    expect(event.type).toBe("customer.subscription.updated");
  });

  it("rejects a body mutated by a single byte after signing", () => {
    const signature = signatureFor(PAYLOAD);

    // One character, in a place JSON does not care about: `sub_123` -> `sub_124`.
    const tampered = PAYLOAD.replace("sub_123", "sub_124");
    expect(tampered).not.toBe(PAYLOAD);
    expect(tampered.length).toBe(PAYLOAD.length);

    expect(() => constructWebhookEvent(tampered, signature)).toThrow();
  });

  it("rejects a body whose whitespace changed, as a re-serialise would", () => {
    const signature = signatureFor(PAYLOAD);
    const reserialised = JSON.stringify(JSON.parse(PAYLOAD), null, 2);

    expect(() => constructWebhookEvent(reserialised, signature)).toThrow();
  });

  it("rejects a signature made with a different secret", () => {
    const foreign = new Stripe(
      "sk_test_unit",
    ).webhooks.generateTestHeaderString({
      payload: PAYLOAD,
      secret: "whsec_someone_elses_secret",
    });

    expect(() => constructWebhookEvent(PAYLOAD, foreign)).toThrow();
  });

  it("rejects a delivery with no signature header at all", () => {
    expect(() => constructWebhookEvent(PAYLOAD, null)).toThrow();
  });

  it("rejects a replayed signature that is older than the tolerance", () => {
    const ancient = Math.floor(Date.now() / 1000) - 60 * 60 * 24;

    expect(() =>
      constructWebhookEvent(PAYLOAD, signatureFor(PAYLOAD, ancient)),
    ).toThrow();
  });
});
