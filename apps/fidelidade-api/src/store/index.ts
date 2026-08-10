import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { requireFeature } from "../plans/require-feature-middleware";
import {
  brazilianStateSchema,
  hexColorSchema,
  slugSchema,
  storeMemberSchema,
  storeRoleSchema,
  storeSchema,
  storeWithRoleSchema,
} from "../schemas";
import { nullableImageUrlSchema } from "../utils/image-url";
import { requireStoreRole } from "../utils/require-store-role";
import { storeAccess } from "../utils/store-access-middleware";
import addMemberCtrl from "./controllers/add-member";
import archiveStoreCtrl from "./controllers/archive-store";
import createStoreCtrl from "./controllers/create-store";
import getStoreCtrl from "./controllers/get-store";
import listMembersCtrl from "./controllers/list-members";
import listStoresCtrl from "./controllers/list-stores";
import removeMemberCtrl from "./controllers/remove-member";
import updateMemberRoleCtrl from "./controllers/update-member-role";
import updateStoreCtrl from "./controllers/update-store";
import updateStoreBrandingCtrl from "./controllers/update-store-branding";

const store = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listStores",
      tags: ["Stores"],
      description: "Lista as lojas em que o usuário atual é membro",
      responses: {
        200: {
          description: "Lojas do usuário com o papel dele em cada uma",
          content: {
            "application/json": {
              schema: resolver(v.array(storeWithRoleSchema)),
            },
          },
        },
      },
    }),
    validator(
      "query",
      v.object({
        includeArchived: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const userId = c.get("userId");
      const { includeArchived } = c.req.valid("query");
      const stores = await listStoresCtrl(userId, includeArchived === "true");
      return c.json(stores);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createStore",
      tags: ["Stores"],
      description: "Cria uma nova loja e o vínculo de proprietário",
      responses: {
        200: {
          description: "Loja criada",
          content: { "application/json": { schema: resolver(storeSchema) } },
        },
        402: { description: "Limite do plano atingido" },
      },
    }),
    validator(
      "json",
      v.object({
        name: v.pipe(v.string(), v.minLength(2, "Nome muito curto")),
        slug: slugSchema,
        whatsapp: v.optional(v.nullable(v.string())),
        city: v.optional(v.nullable(v.string())),
        state: v.optional(v.nullable(brazilianStateSchema)),
        timezone: v.optional(v.string()),
        brandColor: v.optional(hexColorSchema),
        logoUrl: v.optional(nullableImageUrlSchema),
      }),
    ),
    async (c) => {
      const userId = c.get("userId");
      const input = c.req.valid("json");
      const created = await createStoreCtrl(userId, input);
      return c.json(created);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getStore",
      tags: ["Stores"],
      description: "Detalhes de uma loja",
      responses: {
        200: {
          description: "Detalhes da loja",
          content: { "application/json": { schema: resolver(storeSchema) } },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromStore(),
    async (c) => {
      const storeId = c.get("storeId");
      const found = await getStoreCtrl(storeId);
      return c.json(found);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateStore",
      tags: ["Stores"],
      description: "Atualiza os dados cadastrais da loja",
      responses: {
        200: {
          description: "Loja atualizada",
          content: { "application/json": { schema: resolver(storeSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(v.pipe(v.string(), v.minLength(2))),
        slug: v.optional(slugSchema),
        whatsapp: v.optional(v.nullable(v.string())),
        city: v.optional(v.nullable(v.string())),
        state: v.optional(v.nullable(brazilianStateSchema)),
        timezone: v.optional(v.string()),
      }),
    ),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const input = c.req.valid("json");
      const updated = await updateStoreCtrl(storeId, input);
      return c.json(updated);
    },
  )
  .put(
    "/:id/branding",
    describeRoute({
      operationId: "updateStoreBranding",
      tags: ["Stores"],
      description:
        "Atualiza a identidade visual da loja (recurso de plano pago)",
      responses: {
        200: {
          description: "Identidade visual atualizada",
          content: { "application/json": { schema: resolver(storeSchema) } },
        },
        402: { description: "Recurso indisponível no plano atual" },
        403: { description: "Ação permitida apenas ao proprietário" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        brandColor: v.optional(hexColorSchema),
        logoUrl: v.optional(nullableImageUrlSchema),
      }),
    ),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    requireFeature("branding"),
    async (c) => {
      const storeId = c.get("storeId");
      const input = c.req.valid("json");
      const updated = await updateStoreBrandingCtrl(storeId, input);
      return c.json(updated);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "archiveStore",
      tags: ["Stores"],
      description: "Arquiva a loja (exclusão suave)",
      responses: {
        200: {
          description: "Loja arquivada",
          content: { "application/json": { schema: resolver(storeSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const archived = await archiveStoreCtrl(storeId);
      return c.json(archived);
    },
  )
  .get(
    "/:id/members",
    describeRoute({
      operationId: "listStoreMembers",
      tags: ["Stores"],
      description: "Lista a equipe da loja",
      responses: {
        200: {
          description: "Equipe da loja",
          content: {
            "application/json": {
              schema: resolver(v.array(storeMemberSchema)),
            },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromStore(),
    async (c) => {
      const storeId = c.get("storeId");
      const members = await listMembersCtrl(storeId);
      return c.json(members);
    },
  )
  .post(
    "/:id/members",
    describeRoute({
      operationId: "addStoreMember",
      tags: ["Stores"],
      description: "Adiciona uma pessoa à equipe da loja",
      responses: {
        200: {
          description: "Membro adicionado",
          content: {
            "application/json": { schema: resolver(storeMemberSchema) },
          },
        },
        402: { description: "Limite do plano atingido" },
        403: { description: "Ação permitida apenas ao proprietário" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        email: v.pipe(v.string(), v.email("E-mail inválido")),
        role: v.optional(storeRoleSchema, "cashier"),
      }),
    ),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const userId = c.get("userId");
      const input = c.req.valid("json");
      const created = await addMemberCtrl(storeId, userId, input);
      return c.json(created);
    },
  )
  .put(
    "/:id/members/:userId",
    describeRoute({
      operationId: "updateStoreMemberRole",
      tags: ["Stores"],
      description: "Altera o papel de um membro da equipe",
      responses: {
        200: {
          description: "Papel atualizado",
          content: {
            "application/json": { schema: resolver(storeMemberSchema) },
          },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Membro não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string(), userId: v.string() })),
    validator("json", v.object({ role: storeRoleSchema })),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const updated = await updateMemberRoleCtrl(storeId, userId, role);
      return c.json(updated);
    },
  )
  .delete(
    "/:id/members/:userId",
    describeRoute({
      operationId: "removeStoreMember",
      tags: ["Stores"],
      description: "Remove uma pessoa da equipe da loja",
      responses: {
        200: {
          description: "Membro removido",
          content: {
            "application/json": {
              schema: resolver(v.object({ success: v.boolean() })),
            },
          },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Membro não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string(), userId: v.string() })),
    storeAccess.fromStore(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { userId } = c.req.valid("param");
      const result = await removeMemberCtrl(storeId, userId);
      return c.json(result);
    },
  );

export default store;
