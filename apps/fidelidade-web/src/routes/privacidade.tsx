import { createFileRoute } from "@tanstack/react-router";
import LegalDocumentView from "@/components/legal/legal-document";
import { POLITICA_PRIVACIDADE } from "@/content/legal/privacidade";

/**
 * PUBLIC. No `beforeLoad` — the end customer who follows a card link has no
 * account and must still be able to read this.
 */
export const Route = createFileRoute("/privacidade")({
  component: () => <LegalDocumentView document={POLITICA_PRIVACIDADE} />,
});
