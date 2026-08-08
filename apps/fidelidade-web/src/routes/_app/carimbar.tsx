import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";
import { copy } from "@/lib/copy";

export const Route = createFileRoute("/_app/carimbar")({
  component: CarimbarRoute,
});

function CarimbarRoute() {
  return (
    <PhasePlaceholder
      title={copy.nav.carimbar}
      description="Digitar o celular do cliente, confirmar ou criar o cadastro e carimbar. Chega na Fase 2."
    />
  );
}

export default CarimbarRoute;
