import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type CustomerHistory, CustomerHistoryView } from "./customer-history";

afterEach(cleanup);

const empty: CustomerHistory = {
  cards: [],
  rewards: [],
  coupons: [],
  totals: { totalStamps: 0, totalRewards: 0, totalRedeemed: 0 },
};

describe("CustomerHistoryView", () => {
  it("says the customer has no history yet instead of showing empty sections", () => {
    render(<CustomerHistoryView history={empty} />);
    expect(screen.getByText("Ainda sem histórico.")).toBeInTheDocument();
  });

  it("translates server statuses into what the counter reads", () => {
    render(
      <CustomerHistoryView
        history={{
          ...empty,
          totals: { ...empty.totals, totalStamps: 12 },
          cards: [
            {
              id: "card-1",
              cycle: 2,
              stampsCount: 3,
              stampsRequired: 10,
              status: "active",
              completedAt: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("2º cartão")).toBeInTheDocument();
    expect(screen.getByText("3 de 10 carimbos")).toBeInTheDocument();
    expect(screen.getByText("Em andamento")).toBeInTheDocument();
  });

  it("shows an unmapped status as-is rather than blank", () => {
    // A status added on the server later must look wrong, not vanish — a blank
    // badge is indistinguishable from a working one.
    render(
      <CustomerHistoryView
        history={{
          ...empty,
          cards: [
            {
              id: "card-1",
              cycle: 1,
              stampsCount: 1,
              stampsRequired: 10,
              status: "algo_novo",
              completedAt: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("algo_novo")).toBeInTheDocument();
  });

  it("lists rewards with their code and coupons with their campaign", () => {
    render(
      <CustomerHistoryView
        history={{
          ...empty,
          totals: { ...empty.totals, totalRewards: 1, totalRedeemed: 1 },
          rewards: [
            {
              id: "reward-1",
              code: "P4KJ9MN",
              description: "Um café grátis",
              status: "redeemed",
              expiresAt: null,
              redeemedAt: "2026-08-01T12:00:00.000Z",
            },
          ],
          coupons: [
            {
              id: "redemption-1",
              code: "CMECW6Z",
              title: "Semana do Cliente",
              discountLabel: "20% OFF",
              status: "pending",
              expiresAt: null,
              redeemedAt: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Um café grátis")).toBeInTheDocument();
    expect(screen.getByText(/P4KJ9MN/)).toBeInTheDocument();
    expect(screen.getByText("Semana do Cliente")).toBeInTheDocument();
    expect(screen.getByText(/CMECW6Z · 20% OFF/)).toBeInTheDocument();
    expect(screen.getByText("Resgatado")).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
  });
});
