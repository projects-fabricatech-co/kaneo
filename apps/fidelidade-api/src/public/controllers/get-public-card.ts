import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  cardTable,
  customerTable,
  programTable,
  rewardTable,
  stampTable,
  storeTable,
} from "../../database/schema";
import { resolvePlanForStore } from "../../plans/resolve-plan";
import { maskBrPhone } from "../../utils/phone";

/**
 * Matches `stores.brand_color`'s column default. A store on a plan without
 * branding renders in this colour rather than the custom one it may still have
 * stored from a paid period.
 */
const DEFAULT_BRAND_COLOR = "#4F46E5";

/** Most recent 30 stamp instants per card — enough to draw the card, not a log. */
const MAX_STAMP_TIMESTAMPS = 30;

/** "Maria Aparecida da Silva" -> "Maria". */
function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export type PublicCardResponse = {
  token: string;
  store: {
    name: string;
    logoUrl: string | null;
    brandColor: string;
    city: string | null;
    whatsapp: string | null;
  };
  customer: {
    firstName: string | null;
    phoneMasked: string;
  };
  cards: {
    programName: string;
    rewardDescription: string;
    stampsCount: number;
    stampsRequired: number;
    cardColor: string;
    cardTextColor: string;
    status: string;
    cycle: number;
    stampedAt: string[];
  }[];
  rewards: {
    code: string;
    description: string;
    expiresAt: string | null;
  }[];
  coupons: never[];
};

/**
 * THE HIGHEST-RISK ENDPOINT IN THE PRODUCT: unauthenticated, addressed by a
 * bearer-like token in a URL, and it returns tenant data.
 *
 * Every field of the response is written out by hand below. No row is ever spread
 * into the payload, because a spread is a standing promise to leak the next
 * column anybody adds to the schema. Specifically NEVER present: any id
 * (customerId, storeId, programId, cardId), the raw phone, `notes`,
 * `createdByUserId`, `ownerUserId`, `slug`, `addressLine`, `state`, anything from
 * `subscriptions` or `store_members`, and any aggregate about the store or its
 * other customers.
 */
async function getPublicCard(token: string): Promise<PublicCardResponse> {
  const [customer] = await db
    .select({
      id: customerTable.id,
      storeId: customerTable.storeId,
      name: customerTable.name,
      phone: customerTable.phone,
      publicToken: customerTable.publicToken,
      archivedAt: customerTable.archivedAt,
    })
    .from(customerTable)
    .where(eq(customerTable.publicToken, token))
    .limit(1);

  // An archived customer gets the same answer as an unknown token: the link is
  // revoked, and the difference is not the holder's business.
  if (!customer || customer.archivedAt) {
    throw new HTTPException(404, { message: "Cartão não encontrado" });
  }

  const [store] = await db
    .select({
      name: storeTable.name,
      logoUrl: storeTable.logoUrl,
      brandColor: storeTable.brandColor,
      city: storeTable.city,
      whatsapp: storeTable.whatsapp,
    })
    .from(storeTable)
    .where(eq(storeTable.id, customer.storeId))
    .limit(1);

  if (!store) {
    throw new HTTPException(404, { message: "Cartão não encontrado" });
  }

  // Branding is a paid feature, and this page is where it would otherwise leak
  // for free: a downgraded store keeps its stored logo and colour in the
  // database, so the gate has to be applied at render time, not at write time.
  const { limits } = await resolvePlanForStore(customer.storeId);

  const cards = await db
    .select({
      id: cardTable.id,
      stampsCount: cardTable.stampsCount,
      stampsRequired: cardTable.stampsRequired,
      status: cardTable.status,
      cycle: cardTable.cycle,
      programName: programTable.name,
      rewardDescription: programTable.rewardDescription,
      cardColor: programTable.cardColor,
      cardTextColor: programTable.cardTextColor,
    })
    .from(cardTable)
    .innerJoin(programTable, eq(cardTable.programId, programTable.id))
    .where(
      and(
        eq(cardTable.customerId, customer.id),
        inArray(cardTable.status, ["active", "completed"]),
      ),
    )
    .orderBy(asc(cardTable.createdAt));

  const cardIds = cards.map((card) => card.id);

  // Timestamps only, and no `createdByUserId`: which member of staff stamped a
  // card is the shop's internal business, not the customer's.
  const stampRows = cardIds.length
    ? await db
        .select({ cardId: stampTable.cardId, createdAt: stampTable.createdAt })
        .from(stampTable)
        .where(
          and(inArray(stampTable.cardId, cardIds), isNull(stampTable.voidedAt)),
        )
        .orderBy(desc(stampTable.createdAt))
    : [];

  // Only what the customer can still walk in and use. A redeemed code is spent
  // and an expired one is dead; showing either produces a person at the counter
  // holding a code the cashier has to refuse, which is worse than not showing it
  // at all. Three columns, hand-picked: no id, no status, no card linkage.
  const rewards = await db
    .select({
      code: rewardTable.code,
      description: rewardTable.description,
      expiresAt: rewardTable.expiresAt,
    })
    .from(rewardTable)
    .where(
      and(
        eq(rewardTable.customerId, customer.id),
        eq(rewardTable.status, "pending"),
        or(
          isNull(rewardTable.expiresAt),
          gt(rewardTable.expiresAt, sql`now()`),
        ),
      ),
    )
    .orderBy(asc(rewardTable.createdAt));

  const stampedByCard = new Map<string, string[]>();

  for (const row of stampRows) {
    const bucket = stampedByCard.get(row.cardId);

    if (!bucket) {
      stampedByCard.set(row.cardId, [row.createdAt.toISOString()]);
      continue;
    }

    if (bucket.length < MAX_STAMP_TIMESTAMPS) {
      bucket.push(row.createdAt.toISOString());
    }
  }

  return {
    token: customer.publicToken,
    store: {
      name: store.name,
      logoUrl: limits.branding ? store.logoUrl : null,
      brandColor: limits.branding ? store.brandColor : DEFAULT_BRAND_COLOR,
      city: store.city,
      whatsapp: store.whatsapp,
    },
    customer: {
      firstName: firstNameOf(customer.name),
      // Never the raw phone. The mask is here so the holder can confirm the card
      // is theirs, which is the only reason the number appears at all.
      phoneMasked: maskBrPhone(customer.phone),
    },
    cards: cards.map((card) => ({
      programName: card.programName,
      rewardDescription: card.rewardDescription,
      stampsCount: card.stampsCount,
      stampsRequired: card.stampsRequired,
      cardColor: card.cardColor,
      cardTextColor: card.cardTextColor,
      status: card.status,
      cycle: card.cycle,
      stampedAt: stampedByCard.get(card.id) ?? [],
    })),
    rewards: rewards.map((reward) => ({
      code: reward.code,
      description: reward.description,
      expiresAt: reward.expiresAt ? reward.expiresAt.toISOString() : null,
    })),
    // Phase 4 fills `coupons`. Present and empty from day one so the web client
    // never branches on its absence.
    coupons: [],
  };
}

export default getPublicCard;
