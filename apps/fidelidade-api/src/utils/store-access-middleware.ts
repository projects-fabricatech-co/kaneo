import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { validateStoreAccess } from "./validate-store-access";

type LookupResource = "program" | "customer" | "card" | "coupon" | "stamp";

type StoreIdSource =
  | { type: "query"; key: string }
  | { type: "body"; key: string }
  | { type: "param"; key: string }
  | { type: "lookup"; resource: LookupResource; idKey: string };

type StoreAccessMiddlewareConfig = {
  sources: StoreIdSource[];
};

async function readJsonObjectBody(
  c: Context,
): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) || {};

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }

  return raw as Record<string, unknown>;
}

/**
 * Every domain table carries `store_id` directly, so resolving the tenant is
 * always a single-column select on the child table — no joins, and no chance of
 * a join condition silently widening the scope.
 */
async function lookupStoreId(
  resource: LookupResource,
  id: string,
): Promise<string | null> {
  try {
    switch (resource) {
      case "program": {
        const [row] = await db
          .select({ storeId: schema.programTable.storeId })
          .from(schema.programTable)
          .where(eq(schema.programTable.id, id))
          .limit(1);
        return row?.storeId || null;
      }

      case "customer": {
        const [row] = await db
          .select({ storeId: schema.customerTable.storeId })
          .from(schema.customerTable)
          .where(eq(schema.customerTable.id, id))
          .limit(1);
        return row?.storeId || null;
      }

      case "card": {
        const [row] = await db
          .select({ storeId: schema.cardTable.storeId })
          .from(schema.cardTable)
          .where(eq(schema.cardTable.id, id))
          .limit(1);
        return row?.storeId || null;
      }

      case "coupon": {
        const [row] = await db
          .select({ storeId: schema.couponTable.storeId })
          .from(schema.couponTable)
          .where(eq(schema.couponTable.id, id))
          .limit(1);
        return row?.storeId || null;
      }

      case "stamp": {
        const [row] = await db
          .select({ storeId: schema.stampTable.storeId })
          .from(schema.stampTable)
          .where(eq(schema.stampTable.id, id))
          .limit(1);
        return row?.storeId || null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Error looking up storeId for ${resource}:`, error);
    return null;
  }
}

export function storeAccessMiddleware(config: StoreAccessMiddlewareConfig) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");

    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    let storeId: string | null = null;

    for (const source of config.sources) {
      if (source.type === "query") {
        storeId = c.req.query(source.key) || null;
      } else if (source.type === "body") {
        const body = await readJsonObjectBody(c);
        storeId =
          typeof body[source.key] === "string"
            ? (body[source.key] as string)
            : null;
      } else if (source.type === "param") {
        storeId = c.req.param(source.key) || null;
      } else if (source.type === "lookup") {
        const body = await readJsonObjectBody(c);
        const idFromBody =
          typeof body[source.idKey] === "string"
            ? (body[source.idKey] as string)
            : null;
        const id =
          c.req.param(source.idKey) || c.req.query(source.idKey) || idFromBody;

        if (id) {
          storeId = await lookupStoreId(source.resource, id);

          // A child id that resolves to nothing must not fall through to the
          // next source: answer with the same 404 a foreign store would get.
          if (!storeId) {
            throw new HTTPException(404, { message: "Loja não encontrada" });
          }
        }
      }

      if (storeId) {
        break;
      }
    }

    if (!storeId) {
      throw new HTTPException(400, {
        message: "Não foi possível identificar a loja",
      });
    }

    const member = await validateStoreAccess(userId, storeId);

    c.set("storeId", storeId);
    c.set("storeRole", member.role);

    return next();
  };
}

export const storeAccess = {
  fromQuery: (key = "storeId") =>
    storeAccessMiddleware({ sources: [{ type: "query", key }] }),

  fromBody: (key = "storeId") =>
    storeAccessMiddleware({ sources: [{ type: "body", key }] }),

  fromParam: (key = "storeId") =>
    storeAccessMiddleware({ sources: [{ type: "param", key }] }),

  fromStore: (idKey = "id") =>
    storeAccessMiddleware({ sources: [{ type: "param", key: idKey }] }),

  fromProgram: (idKey = "id") =>
    storeAccessMiddleware({
      sources: [{ type: "lookup", resource: "program", idKey }],
    }),

  fromCustomer: (idKey = "id") =>
    storeAccessMiddleware({
      sources: [{ type: "lookup", resource: "customer", idKey }],
    }),

  fromCard: (idKey = "id") =>
    storeAccessMiddleware({
      sources: [{ type: "lookup", resource: "card", idKey }],
    }),

  fromCoupon: (idKey = "id") =>
    storeAccessMiddleware({
      sources: [{ type: "lookup", resource: "coupon", idKey }],
    }),

  fromStamp: (idKey = "id") =>
    storeAccessMiddleware({
      sources: [{ type: "lookup", resource: "stamp", idKey }],
    }),
};
