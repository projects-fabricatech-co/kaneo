import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { storeTable } from "../../database/schema";

async function getStore(storeId: string) {
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

export default getStore;
