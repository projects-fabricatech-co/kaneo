import * as v from "valibot";

export const storeRoleSchema = v.picklist(["owner", "cashier"] as const);

export const storeSchema = v.object({
  id: v.string(),
  ownerUserId: v.string(),
  name: v.string(),
  slug: v.string(),
  logoUrl: v.nullable(v.string()),
  brandColor: v.string(),
  whatsapp: v.nullable(v.string()),
  city: v.nullable(v.string()),
  state: v.nullable(v.string()),
  timezone: v.string(),
  createdAt: v.date(),
  updatedAt: v.date(),
  archivedAt: v.nullable(v.date()),
});

export const storeWithRoleSchema = v.object({
  ...storeSchema.entries,
  role: storeRoleSchema,
});

export const storeMemberSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  userId: v.string(),
  role: storeRoleSchema,
  invitedByUserId: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
  name: v.nullable(v.string()),
  email: v.nullable(v.string()),
  image: v.nullable(v.string()),
});

export const brazilianStateSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z]{2}$/, "UF inválida"),
);

export const hexColorSchema = v.pipe(
  v.string(),
  v.regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
);

export const slugSchema = v.pipe(
  v.string(),
  v.minLength(2, "Slug muito curto"),
  v.maxLength(64, "Slug muito longo"),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
);

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export const programStatusSchema = v.picklist(["active", "archived"] as const);

/**
 * The goal is capped at 100 and the cooldown at 24h so a typo cannot create a
 * card nobody can ever finish, or lock a customer out for a decade.
 */
export const stampsRequiredSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(1, "O cartão precisa de pelo menos 1 carimbo"),
  v.maxValue(100, "O cartão pode ter no máximo 100 carimbos"),
);

export const cooldownMinutesSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(0, "O intervalo não pode ser negativo"),
  v.maxValue(1440, "O intervalo pode ser de no máximo 1440 minutos"),
);

export const rewardValidityDaysSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(1, "A validade precisa ser de pelo menos 1 dia"),
  v.maxValue(3650, "A validade pode ser de no máximo 3650 dias"),
);

export const programSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  name: v.string(),
  stampsRequired: v.number(),
  rewardDescription: v.string(),
  rewardValidityDays: v.number(),
  cooldownMinutes: v.number(),
  cardColor: v.string(),
  cardTextColor: v.string(),
  logoUrl: v.nullable(v.string()),
  status: v.string(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customerSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  name: v.nullable(v.string()),
  phone: v.string(),
  publicToken: v.string(),
  notes: v.nullable(v.string()),
  lastStampAt: v.nullable(v.date()),
  createdAt: v.date(),
  updatedAt: v.date(),
  archivedAt: v.nullable(v.date()),
});

export const customerPageSchema = v.object({
  items: v.array(customerSchema),
  nextCursor: v.nullable(v.string()),
});

/**
 * `created` is what lets the stamp screen say "novo cliente" without a second
 * round trip — find-or-create is otherwise indistinguishable from a plain find.
 */
export const findOrCreateCustomerSchema = v.object({
  customer: customerSchema,
  created: v.boolean(),
});

// ---------------------------------------------------------------------------
// Rewards and redemption codes
//
// Declared BEFORE the stamps section because `stampResultSchema` embeds
// `rewardSchema`: the stamp that fills a card returns the prize it just minted.
// ---------------------------------------------------------------------------

/**
 * The column, which only ever holds these two. Expiry is NOT a status — it is
 * `expiresAt` against the clock, derived wherever a code is displayed.
 */
export const rewardStatusSchema = v.picklist(["pending", "redeemed"] as const);

export const rewardSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  programId: v.string(),
  customerId: v.string(),
  cardId: v.string(),
  code: v.string(),
  description: v.string(),
  status: v.string(),
  expiresAt: v.nullable(v.date()),
  redeemedAt: v.nullable(v.date()),
  redeemedByUserId: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

/**
 * What the cashier typed. Trimmed and upper-cased before anything looks at it,
 * because the alphabet is uppercase-only and a phone keyboard is not: without
 * this, `pk3f9r ` misses a row that is sitting right there.
 *
 * Deliberately NOT `^P[23456789A-Z]{6}$` — the length and the alphabet are
 * `short-code.ts`'s business, and a code that fails to match should come back as
 * "não encontrado" from the store-scoped lookup rather than as a 400 that leaks
 * the code format.
 */
export const shortCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toUpperCase(),
  v.minLength(2, "Código inválido"),
  v.maxLength(32, "Código inválido"),
);

export const codeKindSchema = v.picklist(["reward", "coupon"] as const);

export const codeStateSchema = v.picklist([
  "pending",
  "redeemed",
  "expired",
] as const);

/** The read-only answer to "what is this code?". */
export const validateCodeResultSchema = v.object({
  kind: codeKindSchema,
  code: v.string(),
  description: v.string(),
  status: codeStateSchema,
  expiresAt: v.nullable(v.date()),
  redeemedAt: v.nullable(v.date()),
  usable: v.boolean(),
});

// ---------------------------------------------------------------------------
// Coupons
//
// Declared BEFORE the redemption result below, which embeds both of these: a
// coupon code redeemed at the counter answers with the campaign it belongs to.
// ---------------------------------------------------------------------------

/**
 * `draft` is a campaign the lojista is still writing — it has a link, and that
 * link 404s until it goes `active`. `archived` ends it without deleting the
 * history.
 */
export const couponStatusSchema = v.picklist([
  "draft",
  "active",
  "archived",
] as const);

export const discountTypeSchema = v.picklist([
  "percent",
  "amount",
  "freebie",
] as const);

/**
 * Percent points for `percent`, CENTAVOS for `amount`, and absent for `freebie`.
 * The cross-field rule lives in `coupon/discount.ts`, not here: `PUT` applies it
 * to the merge of the stored row and a partial body, which a body schema cannot
 * see.
 */
export const discountValueSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(1, "O valor precisa ser maior que zero"),
  v.maxValue(10_000_000, "Valor muito alto"),
);

export const maxRedemptionsSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(1, "O limite precisa ser de pelo menos 1"),
  v.maxValue(1_000_000, "Limite muito alto"),
);

export const redemptionValidityDaysSchema = v.pipe(
  v.number(),
  v.integer("Informe um número inteiro"),
  v.minValue(1, "A validade precisa ser de pelo menos 1 dia"),
  v.maxValue(3650, "A validade pode ser de no máximo 3650 dias"),
);

/** An ISO instant over JSON, or `null` to clear the field. */
export const nullableInstantSchema = v.nullable(
  v.pipe(
    v.string(),
    v.isoTimestamp("Data inválida"),
    v.transform((value) => new Date(value)),
  ),
);

export const couponSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  discountType: v.string(),
  discountValue: v.nullable(v.number()),
  discountLabel: v.string(),
  /** The campaign's own token: one link and one QR, shared by everybody. */
  publicToken: v.string(),
  status: v.string(),
  startsAt: v.nullable(v.date()),
  endsAt: v.nullable(v.date()),
  maxRedemptions: v.nullable(v.number()),
  redemptionCount: v.number(),
  redemptionValidityDays: v.number(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const couponRedemptionSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  couponId: v.string(),
  customerId: v.string(),
  code: v.string(),
  status: v.string(),
  expiresAt: v.nullable(v.date()),
  redeemedAt: v.nullable(v.date()),
  redeemedByUserId: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

/**
 * The lojista's view of who claimed a campaign. Authenticated and store-scoped,
 * so the customer's name and number belong here — this is the shop's own base.
 */
export const couponRedemptionWithCustomerSchema = v.object({
  id: v.string(),
  couponId: v.string(),
  code: v.string(),
  status: v.string(),
  expiresAt: v.nullable(v.date()),
  redeemedAt: v.nullable(v.date()),
  redeemedByUserId: v.nullable(v.string()),
  createdAt: v.date(),
  customer: v.object({
    id: v.string(),
    name: v.nullable(v.string()),
    phone: v.string(),
  }),
});

// ---------------------------------------------------------------------------
// Cards and stamps
// ---------------------------------------------------------------------------

export const cardSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  programId: v.string(),
  customerId: v.string(),
  cycle: v.number(),
  stampsCount: v.number(),
  stampsRequired: v.number(),
  status: v.string(),
  completedAt: v.nullable(v.date()),
  redeemedAt: v.nullable(v.date()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

export const stampSourceSchema = v.picklist(["manual", "qr"] as const);

export const stampSchema = v.object({
  id: v.string(),
  storeId: v.string(),
  programId: v.string(),
  customerId: v.string(),
  cardId: v.string(),
  createdByUserId: v.nullable(v.string()),
  source: v.string(),
  idempotencyKey: v.nullable(v.string()),
  voidedAt: v.nullable(v.date()),
  voidedByUserId: v.nullable(v.string()),
  createdAt: v.date(),
});

export const stampResultSchema = v.object({
  stamp: stampSchema,
  card: cardSchema,
  /** True when the idempotency key had already been used: nothing was created. */
  replayed: v.boolean(),
  /** Present only once the card is full: the code the customer now holds. */
  reward: v.nullable(rewardSchema),
});

export const voidStampResultSchema = v.object({
  stamp: stampSchema,
  card: cardSchema,
});

/**
 * Declared here rather than beside `validateCodeResultSchema` because it embeds
 * `cardSchema`: redeeming closes one cycle and opens the next, and the screen
 * shows both — "prêmio entregue" plus "cartão 2 começou, 0/10".
 */
export const redeemRewardResultSchema = v.object({
  kind: v.literal("reward"),
  reward: rewardSchema,
  /** The cycle that was just closed. */
  card: cardSchema,
  /** The empty card the customer starts filling immediately. */
  nextCard: cardSchema,
});

/**
 * A coupon spends flat: no card closes and no cycle opens, because a coupon is
 * not a cycle. `coupons.redemptionCount` is untouched here — it counted the code
 * when it was CLAIMED.
 */
export const redeemCouponResultSchema = v.object({
  kind: v.literal("coupon"),
  redemption: couponRedemptionSchema,
  coupon: couponSchema,
});

/** One endpoint, two kinds. The client switches on `kind`. */
export const redeemCodeResultSchema = v.union([
  redeemRewardResultSchema,
  redeemCouponResultSchema,
]);

// ---------------------------------------------------------------------------
// The unauthenticated customer card
// ---------------------------------------------------------------------------

/**
 * Mirrors the allowlist projection in `get-public-card.ts`. Anything not listed
 * here must not reach an unauthenticated caller — no ids, no raw phone, no
 * staff attribution, nothing about the store's other customers.
 */
export const publicCardSchema = v.object({
  token: v.string(),
  store: v.object({
    name: v.string(),
    logoUrl: v.nullable(v.string()),
    brandColor: v.string(),
    city: v.nullable(v.string()),
    whatsapp: v.nullable(v.string()),
  }),
  customer: v.object({
    firstName: v.nullable(v.string()),
    phoneMasked: v.string(),
  }),
  cards: v.array(
    v.object({
      programName: v.string(),
      rewardDescription: v.string(),
      stampsCount: v.number(),
      stampsRequired: v.number(),
      cardColor: v.string(),
      cardTextColor: v.string(),
      status: v.string(),
      cycle: v.number(),
      stampedAt: v.array(v.string()),
    }),
  ),
  /**
   * Pending and unexpired only, and three fields wide. No id, no status, no
   * `redeemedAt` — a dead code shown to a customer is a promise the shop cannot
   * keep, so it simply is not in the list.
   */
  rewards: v.array(
    v.object({
      code: v.string(),
      description: v.string(),
      expiresAt: v.nullable(v.string()),
    }),
  ),
  /**
   * The store's live campaigns, plus THIS customer's own code for each one when
   * they have claimed it. `myCode` is never another customer's code, and no
   * count, cap or id of the campaign appears here.
   */
  coupons: v.array(
    v.object({
      title: v.string(),
      description: v.nullable(v.string()),
      discountLabel: v.string(),
      endsAt: v.nullable(v.string()),
      myCode: v.nullable(v.string()),
      myCodeExpiresAt: v.nullable(v.string()),
    }),
  ),
});

/**
 * The campaign landing page: what somebody who scanned the poster sees BEFORE
 * typing a phone number. Six fields, and the exact allowlist enforced by
 * `get-public-coupon.ts`.
 *
 * `soldOut` is the only thing said about the cap — never `redemptionCount`,
 * never `maxRedemptions`, and never anything about who else claimed.
 */
export const publicCouponSchema = v.object({
  title: v.string(),
  description: v.nullable(v.string()),
  discountLabel: v.string(),
  endsAt: v.nullable(v.string()),
  soldOut: v.boolean(),
  store: v.object({
    name: v.string(),
    logoUrl: v.nullable(v.string()),
    brandColor: v.string(),
    city: v.nullable(v.string()),
  }),
});

/** What the claim hands back: the personal code, and the way home to the card. */
export const claimPublicCouponSchema = v.object({
  code: v.string(),
  expiresAt: v.nullable(v.string()),
  /** `${FIDELIDADE_CLIENT_URL}/c/<token>` — the customer's own loyalty card. */
  cardUrl: v.string(),
});
