import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  customerPageSchema,
  customerSchema,
  findOrCreateCustomerSchema,
} from "../schemas";
import { requireStoreRole } from "../utils/require-store-role";
import { storeAccess } from "../utils/store-access-middleware";
import archiveCustomerCtrl from "./controllers/archive-customer";
import findOrCreateCustomerCtrl from "./controllers/find-or-create-customer";
import getCustomerCtrl from "./controllers/get-customer";
import listCustomersCtrl from "./controllers/list-customers";
import lookupCustomerCtrl from "./controllers/lookup-customer";
import rotateCustomerTokenCtrl from "./controllers/rotate-customer-token";
import updateCustomerCtrl from "./controllers/update-customer";

/** Query params arrive as strings; validate and coerce at the boundary. */
const pageLimitSchema = v.optional(
  v.pipe(
    v.string(),
    v.regex(/^\d{1,3}$/, "Limite inválido"),
    v.transform(Number),
    v.minValue(1, "Limite inválido"),
    v.maxValue(100, "Limite muito alto"),
  ),
);

/**
 * Reading, looking up, enrolling and renaming a customer are all things that
 * happen with a person standing at the counter, so a cashier may do all four.
 * Archiving and rotating the public token are owner-only: both are destructive
 * from the customer's point of view.
 */
const customer = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listCustomers",
      tags: ["Customers"],
      description:
        "Lista os clientes da loja, com busca e paginação por cursor",
      responses: {
        200: {
          description: "Página de clientes",
          content: {
            "application/json": { schema: resolver(customerPageSchema) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        q: v.optional(v.string()),
        limit: pageLimitSchema,
        cursor: v.optional(v.string()),
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { q, limit, cursor } = c.req.valid("query");
      const page = await listCustomersCtrl(storeId, { q, limit, cursor });
      return c.json(page);
    },
  )
  // Registered before `/:id` so the static segment is never shadowed.
  .get(
    "/lookup",
    describeRoute({
      operationId: "lookupCustomer",
      tags: ["Customers"],
      description: "Busca exata por telefone, para a tela de carimbo",
      responses: {
        200: {
          description:
            "Telefone normalizado e o cliente, ou null quando não existe",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  phone: v.string(),
                  customer: v.nullable(customerSchema),
                }),
              ),
            },
          },
        },
        422: { description: "Telefone inválido" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        phone: v.string(),
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { phone } = c.req.valid("query");
      const result = await lookupCustomerCtrl(storeId, phone);
      return c.json(result);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "findOrCreateCustomer",
      tags: ["Customers"],
      description: "Encontra o cliente pelo telefone ou cadastra um novo",
      responses: {
        200: {
          description: "Cliente encontrado ou criado",
          content: {
            "application/json": {
              schema: resolver(findOrCreateCustomerSchema),
            },
          },
        },
        402: { description: "Limite do plano atingido" },
        422: { description: "Telefone inválido" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        phone: v.string(),
        name: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(120)))),
        notes: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(1000)))),
      }),
    ),
    storeAccess.fromBody(),
    async (c) => {
      const storeId = c.get("storeId");
      const input = c.req.valid("json");
      const result = await findOrCreateCustomerCtrl(storeId, input);
      return c.json(result);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getCustomer",
      tags: ["Customers"],
      description: "Detalhes de um cliente",
      responses: {
        200: {
          description: "Detalhes do cliente",
          content: { "application/json": { schema: resolver(customerSchema) } },
        },
        404: { description: "Cliente não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCustomer(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const found = await getCustomerCtrl(storeId, id);
      return c.json(found);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateCustomer",
      tags: ["Customers"],
      description: "Atualiza o nome e as observações de um cliente",
      responses: {
        200: {
          description: "Cliente atualizado",
          content: { "application/json": { schema: resolver(customerSchema) } },
        },
        404: { description: "Cliente não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(120)))),
        notes: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(1000)))),
      }),
    ),
    storeAccess.fromCustomer(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const updated = await updateCustomerCtrl(storeId, id, input);
      return c.json(updated);
    },
  )
  .post(
    "/:id/archive",
    describeRoute({
      operationId: "archiveCustomer",
      tags: ["Customers"],
      description: "Arquiva um cliente",
      responses: {
        200: {
          description: "Cliente arquivado",
          content: { "application/json": { schema: resolver(customerSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Cliente não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCustomer(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const archived = await archiveCustomerCtrl(storeId, id);
      return c.json(archived);
    },
  )
  .post(
    "/:id/rotate-token",
    describeRoute({
      operationId: "rotateCustomerToken",
      tags: ["Customers"],
      description:
        "Gera um novo link público para o cliente, invalidando o anterior",
      responses: {
        200: {
          description: "Cliente com o novo token",
          content: { "application/json": { schema: resolver(customerSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Cliente não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromCustomer(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const rotated = await rotateCustomerTokenCtrl(storeId, id);
      return c.json(rotated);
    },
  );

export default customer;
