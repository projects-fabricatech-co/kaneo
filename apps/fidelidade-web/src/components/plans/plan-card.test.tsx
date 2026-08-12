import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanCard, type PlanOffer } from "./plan-card";

afterEach(cleanup);

const essencial: PlanOffer = {
  id: "essencial",
  name: "Essencial",
  tagline: "Para a loja que já tem fila",
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
};

const gratis: PlanOffer = {
  id: "gratis",
  name: "Grátis",
  tagline: "Para começar hoje",
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
};

describe("PlanCard", () => {
  it("shows the monthly price in reais", () => {
    render(<PlanCard offer={essencial} interval="month" isCurrent={false} />);
    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("/mês")).toBeInTheDocument();
  });

  it("switches to the annual price and suffix", () => {
    render(<PlanCard offer={essencial} interval="year" isCurrent={false} />);
    expect(screen.getByText("R$ 499,00")).toBeInTheDocument();
    expect(screen.getByText("/ano")).toBeInTheDocument();
  });

  it("says Grátis instead of R$ 0,00 on the free plan", () => {
    render(<PlanCard offer={gratis} interval="month" isCurrent={false} />);
    // "Grátis" is both the plan's name and its price here, so the assertion
    // that carries weight is the absence of a currency figure and a period.
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.getAllByText("Grátis").length).toBeGreaterThan(0);
    expect(screen.queryByText("/mês")).not.toBeInTheDocument();
  });

  it("lists what the plan does NOT include, struck through", () => {
    // Hiding the missing lines makes two plans look alike at a glance, which is
    // the moment someone picks the wrong one.
    render(<PlanCard offer={essencial} interval="month" isCurrent={false} />);
    const reports = screen.getByText("Relatórios avançados");
    expect(reports).toBeInTheDocument();
    expect(reports.className).toContain("line-through");
  });

  it("offers no purchase button for the plan already in use", () => {
    render(
      <PlanCard
        offer={essencial}
        interval="month"
        isCurrent
        onChoose={vi.fn()}
      />,
    );
    expect(screen.getByText("Plano atual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assinar" })).toBeNull();
  });

  it("never offers to buy the free plan", () => {
    render(
      <PlanCard
        offer={gratis}
        interval="month"
        isCurrent={false}
        onChoose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Assinar" })).toBeNull();
  });

  it("reports which plan was chosen", () => {
    const onChoose = vi.fn();
    render(
      <PlanCard
        offer={essencial}
        interval="month"
        isCurrent={false}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assinar" }));
    expect(onChoose).toHaveBeenCalledWith("essencial");
  });
});
