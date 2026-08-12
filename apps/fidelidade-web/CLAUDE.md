# apps/fidelidade-web

Front do **Vale Desconto**. React 19 + Vite + TanStack Router/Query, porta
**5174**. Consome `apps/fidelidade-api` por cliente RPC tipado.

## Comandos

```bash
pnpm --filter @fidelidade/web dev        # porta 5174
pnpm --filter @fidelidade/web test       # 96 de componente e hook
pnpm --filter @fidelidade/web typecheck
pnpm --filter @fidelidade/web build      # regenera routeTree.gen.ts
```

## Armadilhas deste app

Estas são as que custam tempo por serem diferentes do que a memória sugere.

- **`src/routeTree.gen.ts` é gerado.** Nunca edite: o build regenera.
- **Componentes são coss/Base UI, não shadcn/Radix.** `Button` usa a prop
  **`render`**, não `asChild`.
- **Toast é `toastManager` de `@/lib/toast`, não sonner.**
- **`cn` vem de `@/lib/cn`.**
- **Não existe i18next.** Toda string em `src/lib/copy.ts`, tipada, com
  interpolação como função. Nada entra em `/i18n`.
- Formulários: react-hook-form + `standardSchemaResolver` + `zod/v4`.

## Rotas públicas × autenticadas

**Rota pública é um arquivo no topo de `src/routes/` sem `beforeLoad`.** O gate
de sessão vive em `_app.tsx`; qualquer arquivo sob ele exige login.

Públicas hoje: `index.tsx` (landing), `c.$token.tsx` (cartão do cliente),
`cupom.$token.tsx` (campanha), `privacidade.tsx`, `termos.tsx`.

O `onboarding.tsx` fica **fora** do `_app` de propósito — dentro, entraria em
loop de redirect com quem ainda não tem loja.

## Mobile-first, de verdade

O lojista usa no celular, no balcão, com fila esperando. A navegação principal é
tab bar embaixo. `useIsMobile()` corta em 768px; `DialogPopup` com
`bottomStickOnMobile` vira bottom sheet abaixo de `sm:`. Alvos de toque de 44px
já vêm no `Button` via `pointer-coarse:after:min-h-11`.

Ao mexer em tela de balcão, teste em viewport de 390×844.

## Design system

Tokens em `src/index.css`: coral `--vale-coral-*` como primária, `--vale-gold-*`
reservado para **recompensa** (não é decoração — é semântica), neutros quentes
`--vale-stone-*`. Manrope para display, Inter para texto, ambas auto-hospedadas.

Estado nunca é comunicado só por cor. Sucesso usa `--success`, não a coral — a
coral em cartão de confirmação lê como recusa.

## Textos jurídicos

`src/content/legal/` guarda Política, Termos e o texto **versionado** do
consentimento.

- `identidade.ts` é fonte única da identificação da empresa. Enquanto houver
  `TODO`, as páginas exibem aviso de documento não publicado — de propósito.
- **Nunca edite o texto de uma versão de consentimento já publicada.** Crie a
  próxima e aponte `CONSENTIMENTO_ATUAL` para ela: os registros antigos apontam
  para palavras que alguém leu.
- Uma versão nova precisa entrar **primeiro** em
  `apps/fidelidade-api/src/public/consent-versions.ts`, senão o build quebra —
  o tipo literal atravessa a fronteira RPC de propósito.
- `decisoes.md` explica por que cada escolha jurídica foi feita. Leia antes de
  alterar qualquer texto.
