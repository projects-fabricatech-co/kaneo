import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";
import { copy } from "@/lib/copy";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesRoute,
});

function ClientesRoute() {
  return (
    <PhasePlaceholder
      title={copy.nav.clientes}
      description="Lista de clientes, busca por celular e histórico. Chega na Fase 5."
    />
  );
}

export default ClientesRoute;
