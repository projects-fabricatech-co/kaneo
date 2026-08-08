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
