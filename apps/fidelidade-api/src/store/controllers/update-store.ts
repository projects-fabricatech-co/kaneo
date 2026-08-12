import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeTable } from "../../database/schema";
import { normalizeBrPhone } from "../../utils/phone";

export type UpdateStoreInput = {
  name?: string;
  slug?: string;
  whatsapp?: string | null;
  city?: string | null;
  state?: string | null;
  timezone?: string;
};

async function updateStore(storeId: string, input: UpdateStoreInput) {
  const values: Partial<typeof storeTable.$inferInsert> = {};

  if (input.name !== undefined) {
    values.name = input.name;
  }

  if (input.slug !== undefined) {
    values.slug = input.slug;
  }

  if (input.whatsapp !== undefined) {
    values.whatsapp = input.whatsapp?.trim()
      ? normalizeBrPhone(input.whatsapp)
      : null;
  }

  if (input.city !== undefined) {
    values.city = input.city;
  }

  if (input.state !== undefined) {
    values.state = input.state ? input.state.toUpperCase() : null;
  }

  if (input.timezone !== undefined) {
    values.timezone = input.timezone;
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

  // Also scoped by storeId in SQL: two independent checks, so a route wired with
  // the wrong storeAccess.fromX() still cannot write across tenants.
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

export default updateStore;
