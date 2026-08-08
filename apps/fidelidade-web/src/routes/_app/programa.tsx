import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";
import { copy } from "@/lib/copy";

export const Route = createFileRoute("/_app/programa")({
  component: ProgramaRoute,
});

function ProgramaRoute() {
  return (
    <PhasePlaceholder
      title={copy.nav.programa}
      description="Quantos selos, qual a recompensa, validade e a cara do cartão. Chega na Fase 2."
    />
  );
}

export default ProgramaRoute;
