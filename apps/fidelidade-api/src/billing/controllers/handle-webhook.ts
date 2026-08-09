import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type Stripe from "stripe";
import db from "../../database";
import type { DatabaseExecutor } from "../../database/executor";
import {
  stripeEventTable,
  subscriptionTable,
  userTable,
} from "../../database/schema";
import { constructWebhookEvent } from "../stripe-client";
import {
  mapSubscription,
  readInvoiceSubscriptionId,
  readSessionCustomerId,
} from "../subscription-fields";

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export type WebhookResult = {
  received: true;
  outcome: WebhookOutcome;
};

/** Statuses `invoice.payment_failed` is allowed to move a row out of. */
const PAYABLE_STATUSES = ["active", "trialing"];

type SubscriptionValues = Partial<typeof subscriptionTable.$inferInsert>;

async function userExists(
  tx: DatabaseExecutor,
  userId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  return Boolean(row);
}

/**
 * Which account this event belongs to.
 *
 * Metadata first, because that is the only identifier we control end-to-end —
 * it is stamped onto the Subscription at checkout and copied onto every event
 * Stripe renders from it. The lookups by Stripe id are the fallback for events
 * about a subscription created outside our checkout (in the dashboard, say).
 * A metadata id that no longer matches a user is discarded rather than trusted:
 * inserting it would fail the foreign key, return 500, and put Stripe into a
 * retry loop that can never succeed.
 */
async function resolveOwnerUserId(
  tx: DatabaseExecutor,
  candidates: {
    fromMetadata?: string | null;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
  },
): Promise<string | null> {
  if (
    candidates.fromMetadata &&
    (await userExists(tx, candidates.fromMetadata))
  ) {
    return candidates.fromMetadata;
  }

  if (candidates.stripeSubscriptionId) {
    const [row] = await tx
      .select({ ownerUserId: subscriptionTable.ownerUserId })
      .from(subscriptionTable)
      .where(
        eq(
          subscriptionTable.stripeSubscriptionId,
          candidates.stripeSubscriptionId,
        ),
      )
      .limit(1);

    if (row) {
      return row.ownerUserId;
    }
  }

  if (candidates.stripeCustomerId) {
    const [row] = await tx
      .select({ ownerUserId: subscriptionTable.ownerUserId })
      .from(subscriptionTable)
      .where(
        eq(subscriptionTable.stripeCustomerId, candidates.stripeCustomerId),
      )
      .limit(1);

    if (row) {
      return row.ownerUserId;
    }
  }

  return null;
}

async function upsertSubscription(
  tx: DatabaseExecutor,
  ownerUserId: string,
  values: SubscriptionValues,
): Promise<void> {
  await tx
    .insert(subscriptionTable)
    .values({ ownerUserId, ...values })
    .onConflictDoUpdate({
      target: subscriptionTable.ownerUserId,
      set: { ...values, updatedAt: new Date() },
    });
}

async function applyCheckoutSession(
  tx: DatabaseExecutor,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  const stripeCustomerId = readSessionCustomerId(session);
  const ownerUserId = await resolveOwnerUserId(tx, {
    fromMetadata:
      session.client_reference_id ?? session.metadata?.ownerUserId ?? null,
    stripeCustomerId,
  });

  if (!ownerUserId || !stripeCustomerId) {
    return false;
  }

  // Only the customer link. The plan itself is NOT granted here: the session
  // payload carries no price unless the line items are expanded with a second
  // API call, and `customer.subscription.created` — which does carry it —
  // always follows. Granting from a guess here is how the wrong plan sticks.
  await tx
    .insert(subscriptionTable)
    .values({
      ownerUserId,
      stripeCustomerId,
      plan: "gratis",
      status: "incomplete",
    })
    .onConflictDoUpdate({
      target: subscriptionTable.ownerUserId,
      set: { stripeCustomerId, updatedAt: new Date() },
    });

  return true;
}

async function applySubscriptionEvent(
  tx: DatabaseExecutor,
  subscription: Stripe.Subscription,
  deleted: boolean,
): Promise<boolean> {
  const mapped = mapSubscription(subscription);

  const ownerUserId = await resolveOwnerUserId(tx, {
    fromMetadata: mapped.ownerUserIdFromMetadata,
    stripeSubscriptionId: mapped.stripeSubscriptionId,
    stripeCustomerId: mapped.stripeCustomerId,
  });

  if (!ownerUserId) {
    return false;
  }

  // A deletion DOWNGRADES, it never locks. The plan column keeps saying which
  // plan they were on and the status says it lapsed; `effectivePlan` in
  // plans/resolve-plan.ts turns that pair into "gratis" for every limit check,
  // so the shop keeps reading its stores, customers and cards and only
  // CREATING new ones answers 402.
  await upsertSubscription(tx, ownerUserId, {
    plan: mapped.plan,
    status: deleted ? "canceled" : mapped.status,
    billingInterval: mapped.billingInterval,
    stripeSubscriptionId: mapped.stripeSubscriptionId,
    stripePriceId: mapped.stripePriceId,
    currentPeriodEnd: mapped.currentPeriodEnd,
    cancelAtPeriodEnd: deleted ? false : mapped.cancelAtPeriodEnd,
    canceledAt: mapped.canceledAt ?? (deleted ? new Date() : null),
    trialEndsAt: deleted ? null : mapped.trialEndsAt,
    ...(mapped.stripeCustomerId
      ? { stripeCustomerId: mapped.stripeCustomerId }
      : {}),
  });

  return true;
}

/**
 * `customer.subscription.updated` is the authoritative source of status; these
 * two only shuttle a row between `active` and `past_due` so a failed charge
 * shows up on /planos immediately. Both are conditional on the current status so
 * a late invoice event cannot resurrect a cancelled subscription.
 */
async function applyInvoiceEvent(
  tx: DatabaseExecutor,
  invoice: Stripe.Invoice,
  nextStatus: "active" | "past_due",
): Promise<boolean> {
  const stripeSubscriptionId = readInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return false;
  }

  const fromStatuses =
    nextStatus === "past_due" ? PAYABLE_STATUSES : ["past_due"];

  const updated = await tx
    .update(subscriptionTable)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(
      and(
        eq(subscriptionTable.stripeSubscriptionId, stripeSubscriptionId),
        inArray(subscriptionTable.status, fromStatuses),
      ),
    )
    .returning({ id: subscriptionTable.id });

  // Nothing matched when the row is already in the right state, or when the
  // invoice belongs to a subscription we have never linked. Neither is an error.
  return updated.length > 0;
}

async function applyEvent(
  tx: DatabaseExecutor,
  event: Stripe.Event,
): Promise<boolean> {
  // `Stripe.Event` is not a discriminated union in the SDK types — `data.object`
  // is an empty interface — so each branch asserts the shape its `type` promises.
  switch (event.type) {
    case "checkout.session.completed":
      return applyCheckoutSession(
        tx,
        event.data.object as Stripe.Checkout.Session,
      );

    case "customer.subscription.created":
    case "customer.subscription.updated":
      return applySubscriptionEvent(
        tx,
        event.data.object as Stripe.Subscription,
        false,
      );

    case "customer.subscription.deleted":
      return applySubscriptionEvent(
        tx,
        event.data.object as Stripe.Subscription,
        true,
      );

    case "invoice.paid":
      return applyInvoiceEvent(
        tx,
        event.data.object as Stripe.Invoice,
        "active",
      );

    case "invoice.payment_failed":
      return applyInvoiceEvent(
        tx,
        event.data.object as Stripe.Invoice,
        "past_due",
      );

    default:
      // 200, deliberately. Stripe retries every non-2xx for days, so answering
      // 500 to an event type we have no opinion about would build a permanent
      // backlog of deliveries that can never succeed.
      return false;
  }
}

async function handleWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookResult> {
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch {
    // 400, not 500: a payload that fails the HMAC will fail it again on every
    // retry, and the error text is never surfaced — it would only tell a
    // forger which part of their signature was wrong.
    throw new HTTPException(400, {
      message: "Assinatura do webhook inválida",
    });
  }

  // Claim and apply in ONE transaction. Stripe delivers at least once, and the
  // same event id can arrive twice; the primary key on `stripe_event` is what
  // makes the second delivery a no-op. It is an insert-and-claim rather than a
  // select-then-insert because two concurrent deliveries both pass a SELECT.
  // Keeping the apply inside the same transaction matters just as much: if it
  // throws, the claim rolls back with it, so Stripe's retry is re-applied
  // instead of being swallowed as a duplicate of an event that never landed.
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(stripeEventTable)
      .values({ id: event.id, eventType: event.type })
      .onConflictDoNothing({ target: stripeEventTable.id })
      .returning({ id: stripeEventTable.id });

    if (!claimed) {
      return { received: true, outcome: "duplicate" };
    }

    const applied = await applyEvent(tx, event);

    return { received: true, outcome: applied ? "processed" : "ignored" };
  });
}

export default handleWebhook;
