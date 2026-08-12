# apps/web

Front do **Kaneo**, a base open source do fork. React 19 + Vite + TanStack
Router/Query, porta **5173**.

> Se você veio trabalhar no Vale Desconto, este não é o app — veja
> `apps/fidelidade-web/CLAUDE.md`.

## Comandos

```bash
pnpm --filter @kaneo/web dev
pnpm --filter @kaneo/web build
pnpm --filter @kaneo/web preview
pnpm --filter @kaneo/web test
pnpm --filter @kaneo/web typecheck
pnpm --filter @kaneo/web lint
```

## Estrutura

| Onde | O quê |
|---|---|
| `src/routes/` | Rotas file-based do TanStack Router |
| `src/fetchers/{feature}/` | Chamadas à API |
| `src/hooks/queries/` | Hooks de leitura (TanStack Query) |
| `src/hooks/mutations/` | Hooks de escrita |
| `src/components/` | Componentes |

Estado global em Zustand, estilo em Tailwind v4, primitivos de UI em Radix.
Feedback ao usuário por toast (sonner).

## Ao adicionar uma feature

1. Fetcher em `src/fetchers/{feature}/`
2. Hook de query ou mutation em `src/hooks/`
3. TanStack Query para cache
4. Trate carregamento e erro de verdade, não só o caminho feliz

```typescript
// src/hooks/queries/{feature}/use-item.ts
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/fetchers/{feature}/get-item";

export function useItem(itemId: string) {
  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
}
```

## i18n

`/i18n` tem **12 locales**, e `scripts/i18n/check.mjs` compara cada um com
`en-US.json` (1598 chaves), sem allowlist. Chave nova precisa existir em todos,
senão `pnpm i18n:check` quebra.

**Nada do Vale Desconto entra ali** — aquele app é pt-BR único e guarda as
strings em `apps/fidelidade-web/src/lib/copy.ts`.

## Ambiente

`VITE_API_URL` aponta para a API (padrão `http://localhost:1337`). Demais
variáveis no `.env` único da raiz; detalhes em `ENVIRONMENT_SETUP.md`.
