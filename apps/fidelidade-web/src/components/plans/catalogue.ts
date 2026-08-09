import type { PlanOffer } from "./plan-card";

/**
 * What the plans screen SHOWS. Display only.
 *
 * The amounts here are a copy of the Stripe prices, kept in the client so the
 * screen renders in one paint instead of waiting on a round trip. They are
 * never sent anywhere: checkout takes a plan id and an interval, and the SERVER
 * resolves the real Stripe price from its own environment. A client that could
 * name the price it wants to pay is a client that can pick its own price.
 *
 * The limits mirror `PLAN_LIMITS` in the API, which is the enforcing copy — this
 * one only decides which feature lines get a check and which get a strike.
 */
export const PLAN_CATALOGUE: PlanOffer[] = [
  {
    id: "gratis",
    name: "Grátis",
    tagline: "Para começar hoje, sem cartão",
    monthlyCents: null,
    annualCents: null,
    limits: {
      maxStores: 1,
      maxProgramsPerStore: 1,
      maxCustomersPerStore: 50,
      maxMembersPerStore: 1,
      coupons: false,
      branding: false,
      reports: false,
    },
  },
  {
    id: "essencial",
    name: "Essencial",
    tagline: "Para a loja que já tem clientes fiéis",
    monthlyCents: 4990,
    annualCents: 49900,
    limits: {
      maxStores: 1,
      maxProgramsPerStore: 3,
      maxCustomersPerStore: null,
      maxMembersPerStore: 2,
      coupons: true,
      branding: true,
      reports: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Para quem tem mais de uma unidade",
    monthlyCents: 9990,
    annualCents: 99900,
    limits: {
      maxStores: 10,
      maxProgramsPerStore: 10,
      maxCustomersPerStore: null,
      maxMembersPerStore: 10,
      coupons: true,
      branding: true,
      reports: true,
    },
  },
];
