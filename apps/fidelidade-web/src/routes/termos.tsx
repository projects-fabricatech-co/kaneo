import { createFileRoute } from "@tanstack/react-router";
import LegalDocumentView from "@/components/legal/legal-document";
import { TERMOS_DE_USO } from "@/content/legal/termos";

/** PUBLIC. Read before signing up, so it cannot sit behind the auth gate. */
export const Route = createFileRoute("/termos")({
  component: () => <LegalDocumentView document={TERMOS_DE_USO} />,
});
