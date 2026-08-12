# apps/fidelidade-api

API do **Vale Desconto**. Hono + Drizzle + PostgreSQL + Better Auth, porta
**1338**, database próprio `fidelidade`.

## Comandos

```bash
pnpm --filter @fidelidade/api dev              # tsx watch, porta 1338
pnpm --filter @fidelidade/api test             # 116 unitários
pnpm --filter @fidelidade/api test:integration # 236, precisa do Postgres de pé
pnpm --filter @fidelidade/api typecheck
pnpm --filter @fidelidade/api db:generate      # migration após mexer no schema
pnpm --filter @fidelidade/api db:studio
```

Suítes: unitários em `tests/fidelidade-api/` (`vitest.config.ts`), integração em
`tests/fidelidade-api-integration/` (`vitest.integration.config.ts`), com setup e
helpers próprios — os do Kaneo não servem, derivam o nome do banco dele.

Bancos: `fidelidade` e `fidelidade_test`. **As migrations rodam sozinhas quando
a API sobe** — não há passo manual. Se o cluster estiver parado:
`pg_ctlcluster 16 main start`.

`FIDELIDADE_AUTH_SECRET` precisa de 32 caracteres ou a API se recusa a subir —
guarda que só funciona quando outra variável está certa não é guarda.

## A ordem de registro das rotas É a fronteira de segurança

Em `src/index.ts`, tudo registrado no router `api` **antes** de
`api.use("*", authGate)` é público. Tudo depois é autenticado. Mais um allowlist
explícito dentro do gate, só para o webhook do Stripe.

**Mover um bloco de lugar no arquivo muda quem pode chamá-lo, e nada avisa.**
Não existe anotação que possa contradizer a ordem.

Rotas públicas são três, e só três:

| Rota | Cache |
|---|---|
| `GET /api/public/card/:token` | `no-store, private` |
| `GET /api/public/coupon/:token` | `no-store` |
| `POST /api/public/coupon/:token/claim` — **a única escrita não autenticada** | `no-store, private` |

## Anatomia de uma rota

```
validator(param|json) → storeAccess.fromX() → requireStoreRole() → requireFeature() → handler
```

O handler é **fino**: chama **um** controller e devolve `c.json(...)`. A regra de
negócio mora no controller (`src/{feature}/controllers/{verbo}-{coisa}.ts`),
que importa `db` direto e abre transação quando escreve em mais de um lugar.

Toda entrada validada com **Valibot** na borda. Todo endpoint com `describeRoute`.

### Códigos de resposta com significado

| Código | Quando |
|---|---|
| **402** | Limite de plano. Corpo JSON com qual limite, para o front abrir o upgrade. |
| **403** | Só violação de **papel** — caixa tentando fazer coisa de dono. |
| **404** | Inexistente **ou de outro dono**. Nunca 403: seria oráculo de enumeração. |
| **409** | Cooldown do carimbo, código já usado, campanha esgotada. |
| **410** | Código expirado — distinto de inexistente, de propósito. |
| **422** | Entrada inválida, tipicamente telefone impossível. |
| **429** | Limitador do resgate público. |

## Invariantes que o banco garante, não o JavaScript

Cada uma tem teste de integração com **requisições realmente simultâneas**.
Nenhuma dá para provar por leitura — não as substitua por checagem em JS.

| Invariante | Como |
|---|---|
| Cooldown do carimbo | `pg_advisory_xact_lock`, **não** `FOR UPDATE` na linha: a janela atravessa a fronteira de ciclo, e a linha do cartão é substituída no resgate. |
| Toque duplo | `unique(card_id, idempotency_key)` → **200** com o estado atual. Não é erro. |
| Uso único do código | Um `UPDATE ... WHERE status = 'pending' AND expires_at > now() RETURNING *`. Ler antes de decidir é corrida com dinheiro do outro lado. |
| Teto do cupom | `UPDATE ... WHERE redemption_count < max_redemptions` guardado, com decremento compensatório na mesma transação se o insert virar no-op. |
| Limite de plano | Contado **dentro da transação que insere**. Middleware que conta e handler que insere são dois comandos com um intervalo no meio. |
| Webhook do Stripe | Inserção-e-reivindicação em `stripe_event`, com o `evt_...` como PK. Assinatura verificada sobre os **bytes crus**. |

## Schema

`src/database/schema.ts`. CUID2 via `$defaultFn`, nunca default do banco.
`createdAt` e `updatedAt` em toda tabela. **`timestamptz` em tudo** — o painel
agrupa por dia no fuso da loja e o cooldown compara instantes. Todo FK declara
`onDelete` e `onUpdate`, e tem índice. **Sem `pgEnum`**: texto na coluna,
`v.picklist` na borda.

Colunas que carregam decisão:

- `customers.public_token` — **credencial**, não identificador. 32 bytes
  aleatórios em base32url. Vive no cliente, não no cartão, para o link ser
  permanente através dos ciclos.
- `cards.stamps_required` — *snapshot* da meta. Subir a meta não move a linha de
  chegada de quem já está correndo.
- `rewards.card_id` — **único**. "Uma recompensa por cartão completo" é
  invariante do banco, não convenção.

Ao adicionar tabela, registre-a também em `src/database/index.ts` (o objeto
`schema`), senão ela existe no banco e é `undefined` em runtime.

## Respostas públicas são projeções escritas à mão

Nunca despeje a linha do banco numa rota pública. Campo a campo, para que a
próxima coluna sensível não vaze por omissão. O telefone sai mascarado.

O `cardUrl` só é devolvido a quem foi **criado por aquela requisição** — digitar
um telefone não prova posse dele.
