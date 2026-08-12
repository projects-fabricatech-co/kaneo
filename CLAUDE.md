# CLAUDE.md

Mapa do repositório. **Não é manual** — este arquivo é o único que carrega em
toda sessão, então ele custa tokens sempre. Cada app tem o próprio `CLAUDE.md`,
que só é carregado quando o trabalho toca aquele diretório. Leia o de lá antes
de mexer em código.

## Este repositório hospeda dois produtos

| Produto | Onde | Portas |
|---|---|---|
| **Vale Desconto** — cartão de fidelidade digital, pt-BR. É o produto ativo. | `apps/fidelidade-api`, `apps/fidelidade-web` | 1338, 5174 |
| **Kaneo** — gestão de projetos open source. Base do fork, mantido intacto. | `apps/api`, `apps/web`, `apps/site`, `apps/docs` | 1337, 5173 |

Não compartilham banco, autenticação, sessão nem tabela. Dividem o monorepo, o
pnpm e a configuração de build.

## Para onde ir

| Vai mexer em | Leia |
|---|---|
| API do Vale Desconto | `apps/fidelidade-api/CLAUDE.md` |
| Front do Vale Desconto | `apps/fidelidade-web/CLAUDE.md` |
| API do Kaneo | `apps/api/CLAUDE.md` |
| Front do Kaneo | `apps/web/CLAUDE.md` |
| Setup local, do zero | `README.md` |
| O que falta e por quê | Notion — ver abaixo |
| Textos jurídicos | `apps/fidelidade-web/src/content/legal/decisoes.md` |

**A documentação viva do Vale Desconto está no Notion**, não aqui: especificações
no padrão SDD (Spec → Plano → Tarefas), decisões de arquitetura com o custo de
reverter cada uma, documentação funcional e referência técnica.
<https://app.notion.com/p/3ba63359ab9e8101aff3ff17ace9a11a>

Quando o repositório e o Notion divergirem, **o Notion vale**.

## Regras que valem para tudo

1. **Nunca comite segredo.** Existe **um único `.env` na raiz**, gitignored,
   compartilhado por todos os apps. O `.env.sample` documenta apenas os *nomes*.
2. **Nada entra em `/i18n`.** É do Kaneo, tem 12 locales e um checker que
   compara todos com `en-US.json`. O Vale Desconto é pt-BR único, com as strings
   em `apps/fidelidade-web/src/lib/copy.ts`.
3. **Não altere os apps do Kaneo** ao trabalhar no Vale Desconto, e vice-versa.
4. **Leia antes de propor mudança.** Os comentários no código explicam o ataque
   ou a corrida que cada linha evita — quase nunca o óbvio.
5. **Não faça além do pedido.** Feature existe para resolver problema real, não
   para impressionar.

## O que não pode ser descoberto tarde

Fica aqui, e não só no arquivo do app, porque **ignorar qualquer uma destas
produz um defeito** — não uma dúvida. O detalhe de cada uma está no
`CLAUDE.md` do app.

- **A ordem de registro das rotas é a fronteira de segurança.** Em
  `apps/fidelidade-api/src/index.ts`, tudo antes de `api.use("*", authGate)` é
  público. Mover um bloco de lugar muda quem pode chamá-lo, e nada avisa.
- **`customers.public_token` é credencial, não identificador.** Quem tem o link
  vê o cartão e os códigos de prêmio vivos. Nunca o exponha fora da rota pública.
- **Resposta de rota pública é projeção escrita à mão**, campo a campo. Nunca
  despeje a linha do banco: a próxima coluna sensível vazaria por omissão.
- **Concorrência é resolvida no banco, não em JavaScript** — advisory lock no
  cooldown, `UPDATE` guardado no teto do cupom, `UPDATE` atômico no resgate,
  idempotência por índice único. Não troque nenhuma por checagem em JS.
- **Limite de plano é contado dentro da transação que insere.** Contar antes e
  inserir depois são dois comandos com um intervalo no meio.
- **404, nunca 403, para recurso de outro dono** — 403 confirma existência e
  vira oráculo de enumeração entre lojistas.

## Ferramental

- **pnpm** 10.32.1 (fixo em `packageManager`), Node >= 18. Não use npm nem yarn.
- **Biome**: espaço em JS/TS/TSX, aspas duplas, ponto e vírgula. `pnpm lint`
  escreve; `pnpm exec biome ci .` só verifica, e é o que o CI roda. **Arquivos
  CSS e `package.json` estão fora do Biome** — não estranhe se não formatarem.
- **Conventional Commits**, verificados pelo commitlint.
- **O pre-commit roda `biome ci .` e o build do monorepo inteiro.** Commits são
  lentos por isso — rode `pnpm lint` antes, porque `biome ci` não corrige.
- TypeScript: prefira `type` a `interface`; deixe inferir o óbvio. Componentes em
  PascalCase, utilitários e hooks em kebab-case com prefixo `use`.

```bash
pnpm install
pnpm dev            # sobe tudo
pnpm build          # o que o CI e o pre-commit rodam
pnpm test           # unitários de todos os pacotes
```

Comandos por app e o setup de banco estão no `CLAUDE.md` de cada um.
