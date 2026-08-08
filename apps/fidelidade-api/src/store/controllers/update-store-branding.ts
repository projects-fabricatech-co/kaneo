import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeTable } from "../../database/schema";

export type UpdateStoreBrandingInput = {
  brandColor?: string;
  logoUrl?: string | null;
};

/** Route is gated by `requireFeature("branding")`. */
async function updateStoreBranding(
  storeId: string,
  input: UpdateStoreBrandingInput,
) {
  const values: Partial<typeof storeTable.$inferInsert> = {};

  if (input.brandColor !== undefined) {
    values.brandColor = input.brandColor;
  }

  if (input.logoUrl !== undefined) {
    values.logoUrl = input.logoUrl;
  }

  if (Object.keys(values).length === 0) {
    const [store] = await db
      .select()
      .from(storeTable)
      .where(eq(storeTable.id, storeId))
      .limit(1);

    if (!store) {
      throw new HTTPException(404, { message: "Loja não encontrada" });
    }

    return store;
  }

  const [updated] = await db
    .update(storeTable)
    .set(values)
    .where(eq(storeTable.id, storeId))
    .returning();

  if (!updated) {
    throw new HTTPException(404, { message: "Loja não encontrada" });
  }

  return updated;
}

export default updateStoreBranding;
