import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { customerTable } from "../../database/schema";

async function getCustomer(storeId: string, customerId: string) {
  const [customer] = await db
    .select()
    .from(customerTable)
    .where(
      and(eq(customerTable.id, customerId), eq(customerTable.storeId, storeId)),
    )
    .limit(1);

  if (!customer) {
    throw new HTTPException(404, { message: "Cliente não encontrado" });
  }

  return customer;
}

export default getCustomer;
