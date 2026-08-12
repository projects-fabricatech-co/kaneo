import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IDENTIDADE_INCOMPLETA } from "@/content/legal/identidade";
import type { LegalBlock, LegalDocument } from "@/content/legal/types";

/**
 * The effective date is a calendar date, not an instant. Running it through
 * `new Date(...)` would read the ISO string as UTC midnight and render the day
 * before for anyone in Brazil — a legal text that appears to have taken effect
 * a day early is exactly the kind of small wrongness nobody catches.
 */
function formatEffectiveDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * One renderer for every legal document, so Termos and Privacidade cannot drift
 * apart visually and a fix to reading comfort lands on both at once.
 *
 * Two things here are not decoration:
 *   - every section carries its own `id` and a hover anchor, because a support
 *     reply that says "veja a cláusula 4" needs a link that lands on clause 4;
 *   - the missing-identity warning renders ABOVE the text, not in a comment,
 *     because a policy that names no controller identifies nobody and that has
 *     to be impossible to ship by accident.
 */

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "p") {
    return <p className="text-pretty leading-relaxed">{block.text}</p>;
  }

  if (block.kind === "list") {
    return (
      <ul className="flex flex-col gap-2 pl-4">
        {block.items.map((item) => (
          <li key={item} className="list-disc text-pretty leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  // Tables are the one place a legal text beats prose: "who gets what data" is
  // a grid, and flattening it into sentences is how those clauses become vague.
  // On a phone the table scrolls inside itself rather than the page.
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            {block.head.map((cell) => (
              <th key={cell} className="py-2 pr-4 align-bottom font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")} className="border-border/60 border-b">
              {row.map((cell) => (
                <td
                  key={cell}
                  className="py-2.5 pr-4 align-top text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4">
        <Button
          render={<Link to="/" />}
          variant="ghost"
          size="sm"
          className="-ml-2 self-start"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar
        </Button>

        <div className="flex flex-col gap-2">
          <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {document.title}
          </h1>
          <p className="text-pretty text-muted-foreground">
            {document.summary}
          </p>
          <p className="text-sm text-muted-foreground">
            Para: {document.audience} · Em vigor desde{" "}
            {formatEffectiveDate(document.effectiveDate)}
          </p>
        </div>

        {IDENTIDADE_INCOMPLETA ? (
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Documento ainda incompleto</AlertTitle>
            <AlertDescription>
              Faltam os dados de identificação da empresa (razão social, CNPJ,
              endereço, encarregado e foro). Enquanto eles não forem
              preenchidos, este texto não deve ser considerado publicado.
            </AlertDescription>
          </Alert>
        ) : null}
      </header>

      {/* An index, because these pages are consulted, not read start to end. */}
      <nav aria-label="Seções" className="flex flex-col gap-2">
        <p className="font-medium text-sm">Nesta página</p>
        <ul className="flex flex-col gap-1.5">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex flex-col gap-8">
        {document.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="flex scroll-mt-6 flex-col gap-3"
          >
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              <a
                href={`#${section.id}`}
                className="underline-offset-4 hover:underline"
              >
                {section.title}
              </a>
            </h2>
            {section.blocks.map((block, index) => (
              <Block
                // Blocks have no natural id and never reorder at runtime — the
                // document is a static constant.
                // biome-ignore lint/suspicious/noArrayIndexKey: static content
                key={index}
                block={block}
              />
            ))}
          </section>
        ))}
      </main>

      <footer className="flex flex-col gap-2 border-border border-t pt-6 text-sm text-muted-foreground">
        <div className="flex gap-4">
          <Link
            to="/privacidade"
            className="underline-offset-4 hover:underline"
          >
            Política de Privacidade
          </Link>
          <Link to="/termos" className="underline-offset-4 hover:underline">
            Termos de Uso
          </Link>
        </div>
        <p className="text-xs opacity-70">
          Vale Desconto — fidelidade digital para o comércio local.
        </p>
      </footer>
    </div>
  );
}

export default LegalDocumentView;
