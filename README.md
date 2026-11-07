<h1 align="center">Vale Desconto</h1>

<p align="center"><strong>Sua fidelidade vale.</strong></p>

<p align="center">
  Cartão de fidelidade digital para o comércio local. O lojista carimba pelo
  celular, o cliente acompanha por um link — sem conta, sem senha e sem
  aplicativo para instalar.
</p>

<div align="center">

[![CI](https://github.com/projects-fabricatech-co/kaneo/actions/workflows/ci.yml/badge.svg)](https://github.com/projects-fabricatech-co/kaneo/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

<div align="center">
  <h3>
    <a href="#rodando-na-sua-máquina">Rodar localmente</a>
    <span> | </span>
    <a href="ROADMAP.md">Roadmap</a>
    <span> | </span>
    <a href="#decisões-que-valem-conhecer-antes-de-mexer">Decisões de arquitetura</a>
  </h3>
</div>

---

## O que é

Substitui o cartãozinho de papel e o cupom impresso. Um lojista cria um programa
de carimbos, registra as visitas dos clientes pelo celular no balcão, e cada
cliente acompanha o progresso por um link próprio. Ao completar o cartão, o
sistema emite um código curto de uso único que o lojista confere na hora.

A decisão de produto que organiza tudo o resto: **o cliente final não tem conta e
não tem senha.** Ele é identificado pelo telefone e acessa o cartão por um token
opaco na URL. Isso remove o maior atrito de programas de fidelidade digitais e é
a razão de várias escolhas técnicas abaixo.

O produto vive em dois apps deste monorepo. Sobre por que o repositório se chama
`kaneo` e o que mais mora aqui, veja [Sobre este repositório](#sobre-este-repositório).

| | |
|---|---|
| `apps/fidelidade-api` | Hono + Postgres/Drizzle + Better Auth · porta **1338** |
| `apps/fidelidade-web` | React 19 + Vite + TanStack Router/Query · porta **5174** |
| `tests/fidelidade-api` | Testes unitários |
| `tests/fidelidade-api-integration` | Testes de integração (Postgres de verdade) |

---

## Rodando na sua máquina

### O que você precisa

- **Node** >= 18
- **pnpm** 10.32.1 (o repo fixa a versão pelo campo `packageManager`; use `corepack enable`)
- **PostgreSQL** 16 rodando em `localhost:5432`

### 1. Dependências

```bash
pnpm install
```

### 2. Bancos de dados

Vale Desconto usa um database próprio, separado do Kaneo, e um segundo database
só para os testes de integração:

```bash
createdb -h localhost -U postgres fidelidade
createdb -h localhost -U postgres fidelidade_test
```

> Se o cluster estiver parado (comum em container/WSL): `pg_ctlcluster 16 main start`.

### 3. Variáveis de ambiente

Existe **um único `.env` na raiz do projeto**, compartilhado por todos os apps.
Copie o modelo e preencha o bloco `FIDELIDADE_*`:

```bash
cp .env.sample .env
```

O mínimo para subir:

```bash
FIDELIDADE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fidelidade
FIDELIDADE_API_URL=http://localhost:1338
FIDELIDADE_CLIENT_URL=http://localhost:5174
FIDELIDADE_PORT=1338
FIDELIDADE_AUTH_SECRET=   # mínimo 32 caracteres — a API se recusa a subir sem isso
```

Gerando um segredo:

```bash
openssl rand -base64 48
```

**O `.env` é gitignored e continua assim.** O `.env.sample` documenta apenas os
*nomes* das variáveis; nenhuma chave real entra no repositório.

### 4. Subir

Dois terminais, ou dois processos em background:

```bash
pnpm --filter @fidelidade/api dev    # http://localhost:1338
pnpm --filter @fidelidade/web dev    # http://localhost:5174
```

As migrations rodam **sozinhas** quando a API sobe — não há passo manual.

Abra <http://localhost:5174>. O caminho completo é: criar conta → criar loja →
criar o programa de carimbos → carimbar um telefone → abrir o link público do
cartão.

> **Dica:** o produto é feito para celular. No navegador, abra o DevTools e
> escolha um viewport de telefone (390×844). O painel do lojista funciona no
> desktop, mas as telas de balcão foram desenhadas para o polegar.

---

## O dia a dia

```bash
# Qualidade
pnpm lint                                       # biome check --write (escreve)
pnpm exec biome ci .                            # o que o CI roda (só verifica)
pnpm --filter @fidelidade/api typecheck
pnpm --filter @fidelidade/web typecheck

# Testes
pnpm --filter @fidelidade/api test              # unitários
pnpm --filter @fidelidade/api test:integration  # integração (precisa do Postgres de pé)
pnpm --filter @fidelidade/web test              # componentes e hooks

# Build
pnpm build                                      # monorepo inteiro (o pre-commit roda isso)

# Banco
pnpm --filter @fidelidade/api db:generate       # gerar migration depois de mexer no schema
pnpm --filter @fidelidade/api db:studio         # GUI do Drizzle
```

> O hook de pre-commit roda `biome ci .` **e o build do monorepo inteiro**.
> Commits são lentos por isso. Rode `pnpm lint` antes de commitar, porque
> `biome ci` só verifica e não corrige.

### Testando os planos pagos sem o Stripe

```bash
FIDELIDADE_DEV_FORCE_PLAN=pro   # gratis | essencial | pro — ignorado em produção
```

Sem chaves do Stripe configuradas, todo mundo fica no plano Grátis e **os limites
continuam valendo** — foi uma decisão deliberada, senão eles não seriam testáveis.

### Testando o Stripe de verdade

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ESSENCIAL_MONTHLY=price_...
STRIPE_PRICE_ESSENCIAL_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
```

E o encaminhamento do webhook:

```bash
stripe listen --forward-to localhost:1338/api/billing/webhook
```

---

## Como o produto funciona

### Papéis

| | Proprietário | Caixa |
|---|---|---|
| Carimbar, validar código, buscar cliente | ✓ | ✓ |
| Programa, cupons, relatórios | ✓ | — |
| Planos, cobrança, equipe | ✓ | — |

### Planos

| | Grátis | Essencial | Pro |
|---|---|---|---|
| Preço | R$ 0 | R$ 19,99/mês | R$ 49,90/mês |
| Lojas | 1 | 1 | ilimitadas |
| Clientes por loja | 50 | ilimitados | ilimitados |
| Cupons | — | ✓ | ✓ |
| Marca própria | — | ✓ | ✓ |
| Operadores de caixa | 1 | 3 | ilimitados |
| Relatórios | — | — | ✓ |

Os limites são aplicados **no servidor, dentro da transação** que insere — nunca
só na tela. Estourar um limite devolve **402** com um corpo JSON dizendo qual
limite foi, para o front conseguir abrir a tela de upgrade.

---

## Decisões que valem conhecer antes de mexer

Cada uma destas está comentada no arquivo onde vive. Se você for alterar a área,
leia o comentário primeiro — ele explica o ataque ou a corrida que a linha evita.

**A ordem de registro das rotas É a fronteira de segurança.** Tudo que é
registrado em `api` **antes** de `api.use("*", authGate)` fica público. Mover uma
rota de lugar muda quem pode chamá-la. Ver `apps/fidelidade-api/src/index.ts`.

**O token do cliente é credencial, não identificador.** 32 bytes aleatórios em
base32url, nunca CUID2. Quem tem o link vê o cartão, então as respostas públicas
são projeções escritas à mão, nunca a linha do banco. O telefone sai mascarado.

**O link do cartão só é entregue a quem acabou de ser cadastrado.** Digitar um
telefone não prova que o telefone é seu. Um cliente que já existia recebe o
código do cupom, mas não recebe o link — senão o cartaz na parede mais um número
de telefone dariam acesso ao histórico e aos códigos de prêmio de outra pessoa.
Ver `public/controllers/claim-public-coupon.ts`.

**Concorrência é resolvida no banco, não em JavaScript.** O cooldown do carimbo
usa `pg_advisory_xact_lock`; o teto do cupom é um `UPDATE ... WHERE
redemption_count < max_redemptions` guardado; o resgate é um `UPDATE` atômico
com `RETURNING`; o webhook do Stripe é idempotente por inserção-e-reivindicação
em `stripe_event`. Há testes de integração que disparam requisições realmente
simultâneas para cada um desses.

**Carimbo duplicado não é erro.** Toque duplo, retry de rede ou requisição
repetida caem numa chave de idempotência e devolvem **200** com o estado atual: a
intenção do caixa foi satisfeita uma vez.

**Um cartão por ciclo.** Resgatar cria uma linha nova em vez de zerar um
contador, então `stamps.cardId` continua apontando para o ciclo a que pertence e
"uma recompensa por cartão completo" vira invariante do banco.

**404, nunca 403, para recurso de outro dono.** 403 confirmaria que o recurso
existe e viraria um oráculo de enumeração entre lojistas.

**Sem i18n.** O app é pt-BR único e todas as strings vivem em
`apps/fidelidade-web/src/lib/copy.ts`. Nada entra em `/i18n`, que é do Kaneo e
tem 12 locales para manter em dia.

---

## Textos jurídicos

`apps/fidelidade-web/src/content/legal/` guarda a Política de Privacidade, os
Termos de Uso (com o anexo de operador) e o texto versionado do consentimento.
Foram redigidos **sem revisão jurídica**, por decisão do titular do produto.

- `decisoes.md` — documento interno explicando por que cada escolha foi feita e
  o que muda no código se ela for revista. Leia antes de alterar qualquer texto.
- `identidade.ts` — razão social, CNPJ, endereço, encarregado e foro. **Enquanto
  houver `TODO` ali, as duas páginas publicadas exibem um aviso visível de que o
  texto não deve ser considerado publicado.**

---

## Estrutura

```
apps/fidelidade-api/
  drizzle/                 migrations (rodam sozinhas no startup)
  src/
    index.ts               createApp(): CORS, onError, e a ORDEM das rotas
    auth.ts                Better Auth (cookiePrefix próprio, para não brigar com o Kaneo)
    database/schema.ts     todas as tabelas
    plans/                 limites por plano, aplicados no servidor
    public/                as únicas rotas sem autenticação
    {feature}/
      index.ts             rotas finas: validator → acesso → papel → controller
      controllers/         onde mora a regra de negócio

apps/fidelidade-web/
  src/
    routes/                TanStack Router file-based (routeTree.gen.ts é GERADO)
    fetchers/{feature}/    chamadas à API pelo cliente RPC tipado
    hooks/{queries,mutations}/
    components/
    content/legal/         política, termos e consentimento
    lib/copy.ts            todas as strings, em pt-BR
```

### Regras da casa

1. Ler antes de alterar. Os comentários explicam o porquê, não o quê.
2. Toda entrada validada com Valibot, na borda.
3. Handler de rota é fino: um controller, um `c.json(...)`.
4. Nunca editar `routeTree.gen.ts` — o build regenera.
5. Commits em Conventional Commits (o commitlint verifica).

---

## Sobre este repositório

O Vale Desconto foi construído **dentro de um fork do [Kaneo](https://github.com/usekaneo/kaneo)**,
uma plataforma open source de gestão de projetos (MIT). A escolha foi
deliberada: o monorepo já trazia pronto o pnpm + TurboRepo, o Biome, o CI, os
primitivos de UI e os padrões de código, e nada disso precisou ser reinventado.

O código do Kaneo continua aqui, intacto, em `apps/api`, `apps/web`,
`apps/site` e `apps/docs` — nenhuma linha dele foi alterada. Os dois produtos
não compartilham banco, autenticação, sessão nem tabela; dividem apenas o
repositório, o gerenciador de pacotes e a configuração de build.

Documentação do Kaneo: <https://kaneo.app/docs/core>.

## Licença

MIT — veja [LICENSE](LICENSE).

<p align="center">
  Feito pela <a href="https://www.fabricatech.co">Fábrica Tech</a> · D M Tecnologia e Inovação Ltda
</p>
