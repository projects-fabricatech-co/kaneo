# apps/api

API do **Kaneo**, a base open source do fork. Hono + Drizzle + PostgreSQL +
Better Auth, porta **1337**, database `kaneo`.

> Se você veio trabalhar no Vale Desconto, este não é o app — veja
> `apps/fidelidade-api/CLAUDE.md`. Os dois não compartilham nada além do
> monorepo.

## Comandos

```bash
pnpm --filter @kaneo/api dev
pnpm --filter @kaneo/api build
pnpm --filter @kaneo/api db:generate    # migration após mexer no schema
pnpm --filter @kaneo/api db:migrate     # roda sozinha no startup também
pnpm --filter @kaneo/api db:studio
pnpm --filter @kaneo/api lint
```

Testes: `pnpm test` na raiz roda os unitários; integração em
`tests/api-integration/` com `pnpm test:integration`, que precisa de PostgreSQL.
O env dos testes está em `tests/api-integration/setup.ts`.

## Estrutura

- Rotas por feature em `src/{feature}/`, com a lógica extraída para
  `{feature}/controllers/`.
- Todo endpoint usa `describeRoute` para o OpenAPI.
- Toda entrada validada com **Valibot** (o Zod também existe, usado pelo Better
  Auth e por alguns schemas).
- Handler fino: a regra de negócio fica no controller.

## Schema

`src/database/schema.ts`, relações em `src/database/relations.ts`.

- CUID2 como PK, via `createId()`.
- `createdAt` e `updatedAt` em toda tabela.
- Todo FK declara `onDelete` e `onUpdate`.
- Índice nas colunas consultadas com frequência, especialmente FKs.
- Migrations em `apps/api/drizzle/`, aplicadas no startup.

## Autenticação

Better Auth. No Hono, o contexto traz `c.get("userId")`, `c.get("user")` e
`c.get("session")`. API keys por Bearer token.

## Eventos

`publishEvent()` de `src/events/` publica eventos de atividade — mudança de
status, atribuição e afins.

## Exemplo de rota

```typescript
import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import getItem from "./controllers/get-item";

const feature = new Hono<{ Variables: { userId: string } }>()
  .get("/:id",
    describeRoute({
      operationId: "getItem",
      tags: ["Feature"],
      description: "Get item by ID"
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await getItem(id);
      return c.json(item);
    }
  );
```

## Exemplo de tabela

```typescript
export const exampleTable = pgTable("example", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("example_projectId_idx").on(table.projectId),
]);
```

## Ambiente

Variáveis no `.env` único da raiz: `KANEO_CLIENT_URL`, `KANEO_API_URL`,
`AUTH_SECRET` (mín. 32), `DATABASE_URL`, `POSTGRES_*`. Opcionais: `CORS_ORIGINS`,
`REDIS_URL` (Pub/Sub para WebSocket multi-instância), SSO e SMTP.

Detalhes e troubleshooting em `ENVIRONMENT_SETUP.md`.
