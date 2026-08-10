import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  QrCode,
  ShieldCheck,
  Stamp,
  Store,
  TrendingUp,
} from "lucide-react";
import { StampPreview } from "@/components/landing/stamp-preview";
import { PLAN_CATALOGUE } from "@/components/plans/catalogue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatCurrency } from "@/lib/format";

/**
 * Public landing. A top-level route file with no `beforeLoad` — that absence is
 * the entire mechanism that makes a route public.
 *
 * The head metadata and JSON-LD live in `index.html` rather than being injected
 * here: a crawler that does not run JavaScript still has to see the title, the
 * description and the structured data.
 */
export const Route = createFileRoute("/")({
  component: LandingRoute,
});

const PROOF_ICONS = [QrCode, Store, ShieldCheck, TrendingUp];

function LandingRoute() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <span className="font-heading text-lg font-extrabold tracking-tight">
          Vale <span className="text-primary">Desconto</span>
        </span>
        <Button render={<Link to="/auth/entrar" />} variant="ghost" size="sm">
          {copy.landing.ctaSecondary}
        </Button>
      </header>

      <main id="conteudo" className="flex flex-col">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-secondary px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-5 lg:flex-1">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand-foreground">
                {copy.landing.eyebrow}
              </span>
              <h1 className="text-balance font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                {copy.landing.title}
              </h1>
              <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
                {copy.landing.subtitle}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button render={<Link to="/auth/cadastrar" />} size="lg">
                  <Stamp aria-hidden="true" className="size-5" />
                  {copy.landing.ctaPrimary}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {copy.landing.ctaNote}
              </p>
            </div>

            <div className="lg:flex-1">
              <Card className="mx-auto max-w-sm">
                <CardContent className="flex flex-col gap-4 py-6">
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground"
                    >
                      P
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">Padaria da Esquina</span>
                      <span className="text-sm text-muted-foreground">
                        Cartão do Café
                      </span>
                    </div>
                  </div>
                  <StampPreview earned={7} total={10} />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.landing.howTitle}
            </h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {copy.landing.steps.map((step, index) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-2 py-6">
                      <span
                        aria-hidden="true"
                        className="font-heading text-2xl font-extrabold text-brand"
                      >
                        0{index + 1}
                      </span>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {step.body}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Who it is for ────────────────────────────────────────────────── */}
        <section className="bg-card px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.landing.audienceTitle}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {copy.landing.segments.map((segment) => (
                <li key={segment}>
                  <Badge variant="secondary" className="text-sm">
                    {segment}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Why it is not just another discount app ──────────────────────── */}
        <section className="px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.landing.proofTitle}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {copy.landing.proofs.map((proof, index) => {
                const Icon = PROOF_ICONS[index] ?? Check;

                return (
                  <li key={proof.title}>
                    <Card className="h-full">
                      <CardContent className="flex h-full flex-col gap-2 py-6">
                        <Icon
                          aria-hidden="true"
                          className="size-5 text-brand"
                        />
                        <h3 className="font-semibold">{proof.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {proof.body}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>

            <Card className="border-brand/30 bg-secondary">
              <CardContent className="flex flex-col gap-2 py-6">
                <h3 className="font-semibold">{copy.landing.notTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {copy.landing.notBody}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <section className="bg-card px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.landing.pricingTitle}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {PLAN_CATALOGUE.map((offer) => (
                <li key={offer.id}>
                  <Card className="h-full">
                    <CardContent className="flex h-full flex-col gap-3 py-6">
                      <h3 className="font-semibold">{offer.name}</h3>
                      <p className="flex items-baseline gap-1">
                        <span className="font-heading text-3xl font-extrabold">
                          {offer.monthlyCents === null
                            ? copy.plans.free
                            : formatCurrency(offer.monthlyCents)}
                        </span>
                        {offer.monthlyCents === null ? null : (
                          <span className="text-sm text-muted-foreground">
                            {copy.plans.perMonth}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {offer.tagline}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {copy.landing.pricingNote}
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="px-5 py-14 sm:py-20">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.landing.faqTitle}
            </h2>
            {/* Native <details> rather than a JS accordion: the answers are in the
                markup for a crawler even with scripting off, which is the whole
                point of putting an FAQ on a landing page. */}
            <ul className="flex flex-col gap-3">
              {copy.landing.faq.map((item) => (
                <li key={item.q}>
                  <details className="group rounded-xl border border-border bg-card px-4 py-3">
                    <summary className="cursor-pointer list-none font-medium marker:content-none">
                      {item.q}
                    </summary>
                    <p className="pt-2 text-sm text-muted-foreground">
                      {item.a}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Closing ──────────────────────────────────────────────────────── */}
        <section className="bg-foreground px-5 py-16 text-background sm:py-24">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5">
            <h2 className="text-balance font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {copy.landing.finalTitle}
            </h2>
            <p className="text-pretty text-lg opacity-80">
              {copy.landing.finalBody}
            </p>
            <Button render={<Link to="/auth/cadastrar" />} size="lg">
              <Stamp aria-hidden="true" className="size-5" />
              {copy.landing.ctaPrimary}
            </Button>
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 px-5 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <span className="font-heading font-extrabold tracking-tight">
            Vale <span className="text-primary">Desconto</span>
          </span>
          <p className="text-sm text-muted-foreground">
            {copy.landing.footerTagline}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.landing.footerRights(new Date().getFullYear())}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingRoute;
