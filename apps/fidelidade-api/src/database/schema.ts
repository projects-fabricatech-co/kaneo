import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Every timestamp in this schema is `withTimezone: true` (a deliberate
 * deviation from Kaneo's naive timestamps): the dashboard buckets activity by
 * the store's own timezone and the stamp cooldown compares instants, so the
 * offset has to survive the round trip.
 */

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const userTable = pgTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessionTable = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const accountTable = pgTable(
  "account",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verificationTable = pgTable(
  "verification",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const storeTable = pgTable(
  "stores",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    brandColor: text("brand_color").default("#D93825").notNull(),
    whatsapp: text("whatsapp"),
    city: text("city"),
    state: text("state"),
    timezone: text("timezone").default("America/Sao_Paulo").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("stores_ownerUserId_idx").on(table.ownerUserId),
    unique("stores_slug_unique").on(table.slug),
  ],
);

export const storeMemberTable = pgTable(
  "store_members",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").default("cashier").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("store_members_store_user_unique").on(table.storeId, table.userId),
    index("store_members_storeId_idx").on(table.storeId),
    index("store_members_userId_idx").on(table.userId),
    index("store_members_invitedByUserId_idx").on(table.invitedByUserId),
  ],
);

export const programTable = pgTable(
  "programs",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    stampsRequired: integer("stamps_required").default(10).notNull(),
    rewardDescription: text("reward_description").notNull(),
    rewardValidityDays: integer("reward_validity_days").default(30).notNull(),
    cooldownMinutes: integer("cooldown_minutes").default(60).notNull(),
    cardColor: text("card_color").default("#D93825").notNull(),
    cardTextColor: text("card_text_color").default("#FFFFFF").notNull(),
    logoUrl: text("logo_url"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("programs_storeId_idx").on(table.storeId),
    uniqueIndex("programs_store_name_active_unique")
      .on(table.storeId, table.name)
      .where(sql`${table.status} = 'active'`),
  ],
);

/**
 * The public token lives here, NOT on `cards`: the customer's link/QR has to be
 * permanent, while a card row is recreated on every cycle.
 */
export const customerTable = pgTable(
  "customers",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name"),
    phone: text("phone").notNull(),
    publicToken: text("public_token").notNull(),
    notes: text("notes"),
    lastStampAt: timestamp("last_stamp_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    unique("customers_store_phone_unique").on(table.storeId, table.phone),
    unique("customers_publicToken_unique").on(table.publicToken),
    index("customers_storeId_createdAt_idx").on(table.storeId, table.createdAt),
  ],
);

/**
 * One card row per cycle — a redemption creates a NEW row rather than resetting
 * a counter, so `stamps.cardId` keeps pointing at the cycle it belongs to and
 * `rewards.cardId` can be unique.
 */
export const cardTable = pgTable(
  "cards",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    programId: text("program_id")
      .notNull()
      .references(() => programTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    cycle: integer("cycle").default(1).notNull(),
    stampsCount: integer("stamps_count").default(0).notNull(),
    // Snapshot of the program goal at card creation: raising the goal must not
    // move the finish line for cards already in flight.
    stampsRequired: integer("stamps_required").notNull(),
    status: text("status").default("active").notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    redeemedAt: timestamp("redeemed_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cards_storeId_status_idx").on(table.storeId, table.status),
    index("cards_customerId_idx").on(table.customerId),
    index("cards_programId_idx").on(table.programId),
    unique("cards_program_customer_cycle_unique").on(
      table.programId,
      table.customerId,
      table.cycle,
    ),
    uniqueIndex("cards_program_customer_live_unique")
      .on(table.programId, table.customerId)
      .where(sql`${table.status} in ('active','completed')`),
  ],
);

/**
 * storeId / programId / customerId are denormalized on purpose: a single-table
 * cooldown lookup, single-table dashboard aggregates, and tenant scoping with
 * no joins.
 */
export const stampTable = pgTable(
  "stamps",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    programId: text("program_id")
      .notNull()
      .references(() => programTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    cardId: text("card_id")
      .notNull()
      .references(() => cardTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdByUserId: text("created_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    source: text("source").default("manual").notNull(),
    idempotencyKey: text("idempotency_key"),
    voidedAt: timestamp("voided_at", { mode: "date", withTimezone: true }),
    voidedByUserId: text("voided_by_user_id").references(() => userTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("stamps_card_idempotency_unique").on(
      table.cardId,
      table.idempotencyKey,
    ),
    index("stamps_storeId_createdAt_idx").on(table.storeId, table.createdAt),
    index("stamps_customerId_programId_createdAt_idx").on(
      table.customerId,
      table.programId,
      table.createdAt,
    ),
    index("stamps_cardId_idx").on(table.cardId),
    index("stamps_programId_idx").on(table.programId),
    index("stamps_createdByUserId_idx").on(table.createdByUserId),
    index("stamps_voidedByUserId_idx").on(table.voidedByUserId),
  ],
);

export const rewardTable = pgTable(
  "rewards",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    programId: text("program_id")
      .notNull()
      .references(() => programTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    cardId: text("card_id")
      .notNull()
      .references(() => cardTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    code: text("code").notNull(),
    description: text("description").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { mode: "date", withTimezone: true }),
    redeemedByUserId: text("redeemed_by_user_id").references(
      () => userTable.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("rewards_store_code_unique").on(table.storeId, table.code),
    // Structural guarantee: at most one reward per card.
    unique("rewards_cardId_unique").on(table.cardId),
    index("rewards_storeId_status_idx").on(table.storeId, table.status),
    index("rewards_customerId_idx").on(table.customerId),
    index("rewards_programId_idx").on(table.programId),
    index("rewards_redeemedByUserId_idx").on(table.redeemedByUserId),
  ],
);

export const couponTable = pgTable(
  "coupons",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    title: text("title").notNull(),
    description: text("description"),
    discountType: text("discount_type").notNull(),
    // Percent points for `percent`, centavos for `amount`, null for `freebie`.
    discountValue: integer("discount_value"),
    discountLabel: text("discount_label").notNull(),
    publicToken: text("public_token").notNull(),
    status: text("status").default("active").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").default(0).notNull(),
    redemptionValidityDays: integer("redemption_validity_days")
      .default(7)
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("coupons_publicToken_unique").on(table.publicToken),
    index("coupons_storeId_status_idx").on(table.storeId, table.status),
  ],
);

export const couponRedemptionTable = pgTable(
  "coupon_redemptions",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    couponId: text("coupon_id")
      .notNull()
      .references(() => couponTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    code: text("code").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { mode: "date", withTimezone: true }),
    redeemedByUserId: text("redeemed_by_user_id").references(
      () => userTable.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("coupon_redemptions_store_code_unique").on(
      table.storeId,
      table.code,
    ),
    // v1 rule: one redemption per customer per campaign. Makes claiming
    // idempotent with no count-then-insert race.
    unique("coupon_redemptions_coupon_customer_unique").on(
      table.couponId,
      table.customerId,
    ),
    index("coupon_redemptions_couponId_status_idx").on(
      table.couponId,
      table.status,
    ),
    index("coupon_redemptions_customerId_idx").on(table.customerId),
    index("coupon_redemptions_storeId_idx").on(table.storeId),
    index("coupon_redemptions_redeemedByUserId_idx").on(table.redeemedByUserId),
  ],
);

/**
 * The subscription hangs off the OWNER USER, not the store: "Pro = várias
 * lojas" is a limit on the NUMBER of stores, which a per-store row cannot
 * express.
 */
export const subscriptionTable = pgTable(
  "subscriptions",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    plan: text("plan").default("gratis").notNull(),
    // Mirrors Stripe subscription statuses verbatim.
    status: text("status").default("active").notNull(),
    billingInterval: text("billing_interval"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "date",
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    canceledAt: timestamp("canceled_at", { mode: "date", withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("subscriptions_ownerUserId_unique").on(table.ownerUserId),
    unique("subscriptions_stripeSubscriptionId_unique").on(
      table.stripeSubscriptionId,
    ),
    unique("subscriptions_stripeCustomerId_unique").on(table.stripeCustomerId),
    index("subscriptions_status_idx").on(table.status),
  ],
);

/** Webhook idempotency ledger — the id is Stripe's own `evt_...`. */
export const stripeEventTable = pgTable("stripe_event", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Proof that a person agreed, and to WHAT.
 *
 * LGPD art. 8º, §1º puts the burden on the controller to demonstrate consent —
 * and demonstrating it means being able to show the words the person read, not
 * just a boolean. So this stores the version identifier of the text alongside
 * the timestamp; the texts themselves are versioned in the web app under
 * `content/legal/consentimento.ts` and are never edited in place.
 *
 * Only the coupon page writes here. The counter stamp does not: nobody clicks
 * anything at the counter, so it runs on the lojista's legitimate interest and
 * a consent row there would be a record of something that never happened.
 *
 * The IP is kept because a consent nobody can attribute is a consent nobody can
 * defend, and dropped from every read path — nothing in the product ever shows
 * it back.
 */
export const consentRecordTable = pgTable(
  "consent_records",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customerTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    /** Where the person consented. Today only `coupon_claim`. */
    source: text("source").notNull(),
    /** e.g. `consentimento-cupom-v1`. Points at an immutable published text. */
    textVersion: text("text_version").notNull(),
    /** The campaign token the person came through, when there was one. */
    couponId: text("coupon_id").references(() => couponTable.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One row per (person, campaign, text). Makes the write idempotent under a
    // refresh or a retried request, the same way the redemption itself is.
    unique("consent_records_customer_coupon_version_unique").on(
      table.customerId,
      table.couponId,
      table.textVersion,
    ),
    index("consent_records_customerId_idx").on(table.customerId),
    index("consent_records_storeId_createdAt_idx").on(
      table.storeId,
      table.createdAt,
    ),
  ],
);
