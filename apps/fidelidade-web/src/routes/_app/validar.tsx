import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";
import { copy } from "@/lib/copy";

export const Route = createFileRoute("/_app/validar")({
  component: ValidarRoute,
});

function ValidarRoute() {
  return (
    <PhasePlaceholder
      title={copy.nav.validar}
      description="Digitar o código que o cliente mostra e baixar o resgate. Chega na Fase 3."
    />
  );
}

export default ValidarRoute;
