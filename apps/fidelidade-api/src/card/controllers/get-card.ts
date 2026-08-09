import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { cardTable } from "../../database/schema";

async function getCard(storeId: string, cardId: string) {
  const [card] = await db
    .select()
    .from(cardTable)
    .where(and(eq(cardTable.id, cardId), eq(cardTable.storeId, storeId)))
    .limit(1);

  if (!card) {
    throw new HTTPException(404, { message: "Cartão não encontrado" });
  }

  return card;
}

export default getCard;
