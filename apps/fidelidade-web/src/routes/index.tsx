import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

/**
 * Public landing. A top-level route file with no `beforeLoad` — that absence is
 * the entire mechanism that makes a route public. Phase 7 replaces this
 * placeholder with the real page (how it works, pricing, SEO metadata).
 */
export const Route = createFileRoute("/")({
  component: LandingRoute,
});

function LandingRoute() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-4">
        <span className="text-sm font-medium text-muted-foreground">
          {copy.landing.eyebrow}
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {copy.landing.title}
        </h1>
        <p className="text-pretty text-lg text-muted-foreground">
          {copy.landing.subtitle}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button render={<Link to="/auth/cadastrar" />} size="lg">
          {copy.landing.ctaPrimary}
        </Button>
        <Button render={<Link to="/auth/entrar" />} size="lg" variant="outline">
          {copy.landing.ctaSecondary}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{copy.landing.note}</p>
    </main>
  );
}

export default LandingRoute;
