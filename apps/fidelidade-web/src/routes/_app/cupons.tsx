import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";
import { copy } from "@/lib/copy";

export const Route = createFileRoute("/_app/cupons")({
  component: CuponsRoute,
});

function CuponsRoute() {
  return (
    <PhasePlaceholder
      title={copy.nav.cupons}
      description="Criar campanha de desconto, ver link e QR e acompanhar resgates. Chega na Fase 4."
    />
  );
}

export default CuponsRoute;
