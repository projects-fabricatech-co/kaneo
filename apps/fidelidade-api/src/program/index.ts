import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import {
  cooldownMinutesSchema,
  hexColorSchema,
  programSchema,
  programStatusSchema,
  rewardValidityDaysSchema,
  stampsRequiredSchema,
} from "../schemas";
import { nullableImageUrlSchema } from "../utils/image-url";
import { requireStoreRole } from "../utils/require-store-role";
import { storeAccess } from "../utils/store-access-middleware";
import archiveProgramCtrl from "./controllers/archive-program";
import createProgramCtrl from "./controllers/create-program";
import getProgramCtrl from "./controllers/get-program";
import listProgramsCtrl from "./controllers/list-programs";
import updateProgramCtrl from "./controllers/update-program";

/**
 * Reads are open to the whole team (a cashier's stamp screen needs the program's
 * goal and colours); every write is owner-only, because changing the reward or
 * the goal is a commercial decision.
 */
const program = new Hono<{
  Variables: {
    userId: string;
    storeId: string;
    storeRole: string;
  };
}>()
  .get(
    "/",
    describeRoute({
      operationId: "listPrograms",
      tags: ["Programs"],
      description: "Lista os programas de fidelidade da loja",
      responses: {
        200: {
          description: "Programas da loja",
          content: {
            "application/json": { schema: resolver(v.array(programSchema)) },
          },
        },
        404: { description: "Loja não encontrada" },
      },
    }),
    validator(
      "query",
      v.object({
        storeId: v.string(),
        includeArchived: v.optional(v.string()),
      }),
    ),
    storeAccess.fromQuery(),
    async (c) => {
      const storeId = c.get("storeId");
      const { includeArchived } = c.req.valid("query");
      const programs = await listProgramsCtrl(
        storeId,
        includeArchived === "true",
      );
      return c.json(programs);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createProgram",
      tags: ["Programs"],
      description: "Cria um programa de fidelidade",
      responses: {
        200: {
          description: "Programa criado",
          content: { "application/json": { schema: resolver(programSchema) } },
        },
        402: { description: "Limite do plano atingido" },
        403: { description: "Ação permitida apenas ao proprietário" },
        409: { description: "Já existe um programa ativo com este nome" },
      },
    }),
    validator(
      "json",
      v.object({
        storeId: v.string(),
        name: v.pipe(
          v.string(),
          v.minLength(2, "Nome muito curto"),
          v.maxLength(120, "Nome muito longo"),
        ),
        rewardDescription: v.pipe(
          v.string(),
          v.minLength(2, "Descreva o prêmio"),
          v.maxLength(280, "Descrição muito longa"),
        ),
        stampsRequired: v.optional(stampsRequiredSchema),
        rewardValidityDays: v.optional(rewardValidityDaysSchema),
        cooldownMinutes: v.optional(cooldownMinutesSchema),
        cardColor: v.optional(hexColorSchema),
        cardTextColor: v.optional(hexColorSchema),
        logoUrl: v.optional(nullableImageUrlSchema),
      }),
    ),
    storeAccess.fromBody(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const input = c.req.valid("json");
      const created = await createProgramCtrl(storeId, input);
      return c.json(created);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getProgram",
      tags: ["Programs"],
      description: "Detalhes de um programa de fidelidade",
      responses: {
        200: {
          description: "Detalhes do programa",
          content: { "application/json": { schema: resolver(programSchema) } },
        },
        404: { description: "Programa não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromProgram(),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const found = await getProgramCtrl(storeId, id);
      return c.json(found);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateProgram",
      tags: ["Programs"],
      description: "Atualiza um programa de fidelidade",
      responses: {
        200: {
          description: "Programa atualizado",
          content: { "application/json": { schema: resolver(programSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Programa não encontrado" },
        409: { description: "Já existe um programa ativo com este nome" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.optional(
          v.pipe(
            v.string(),
            v.minLength(2, "Nome muito curto"),
            v.maxLength(120, "Nome muito longo"),
          ),
        ),
        rewardDescription: v.optional(
          v.pipe(
            v.string(),
            v.minLength(2, "Descreva o prêmio"),
            v.maxLength(280, "Descrição muito longa"),
          ),
        ),
        stampsRequired: v.optional(stampsRequiredSchema),
        rewardValidityDays: v.optional(rewardValidityDaysSchema),
        cooldownMinutes: v.optional(cooldownMinutesSchema),
        cardColor: v.optional(hexColorSchema),
        cardTextColor: v.optional(hexColorSchema),
        logoUrl: v.optional(nullableImageUrlSchema),
        status: v.optional(programStatusSchema),
      }),
    ),
    storeAccess.fromProgram(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const updated = await updateProgramCtrl(storeId, id, input);
      return c.json(updated);
    },
  )
  .post(
    "/:id/archive",
    describeRoute({
      operationId: "archiveProgram",
      tags: ["Programs"],
      description: "Arquiva um programa de fidelidade",
      responses: {
        200: {
          description: "Programa arquivado",
          content: { "application/json": { schema: resolver(programSchema) } },
        },
        403: { description: "Ação permitida apenas ao proprietário" },
        404: { description: "Programa não encontrado" },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    storeAccess.fromProgram(),
    requireStoreRole("owner"),
    async (c) => {
      const storeId = c.get("storeId");
      const { id } = c.req.valid("param");
      const archived = await archiveProgramCtrl(storeId, id);
      return c.json(archived);
    },
  );

export default program;
