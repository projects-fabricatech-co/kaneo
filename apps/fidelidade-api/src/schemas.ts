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
export const redeemCodeResultSchema = v.object({
  kind: codeKindSchema,
  reward: rewardSchema,
  /** The cycle that was just closed. */
  card: cardSchema,
  /** The empty card the customer starts filling immediately. */
  nextCard: cardSchema,
});

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
  coupons: v.array(v.never()),
});
