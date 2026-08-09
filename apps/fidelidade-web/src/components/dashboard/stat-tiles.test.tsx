import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type DashboardSummary, StatTiles } from "./stat-tiles";

afterEach(cleanup);

const zeroed: DashboardSummary = {
  stampsToday: 0,
  stampsWeek: 0,
  activeCustomers: 0,
  newCustomersWeek: 0,
  cardsNearGoal: 0,
  pendingRewards: 0,
  couponsActive: 0,
};

function tileFor(label: string) {
  const listItem = screen.getByText(label).closest("li");
  if (!listItem) throw new Error(`no tile for "${label}"`);
  return within(listItem);
}

describe("StatTiles", () => {
  it("shows a zero rather than an empty tile", () => {
    // A blank tile reads as "still loading" to the lojista. A quiet Tuesday is
    // information, and it has to look like a number.
    render(<StatTiles summary={zeroed} />);
    expect(tileFor("Carimbos hoje").getByText("0")).toBeInTheDocument();
  });

  it("puts each number under its own label", () => {
    render(
      <StatTiles summary={{ ...zeroed, stampsToday: 7, cardsNearGoal: 3 }} />,
    );

    expect(tileFor("Carimbos hoje").getByText("7")).toBeInTheDocument();
    expect(tileFor("Perto de completar").getByText("3")).toBeInTheDocument();
  });

  it("formats thousands the Brazilian way", () => {
    render(<StatTiles summary={{ ...zeroed, stampsWeek: 1234 }} />);
    expect(
      tileFor("Carimbos na semana").getByText("1.234"),
    ).toBeInTheDocument();
  });

  it("explains what counts as an active customer", () => {
    render(<StatTiles summary={zeroed} />);
    expect(
      screen.getByText("Carimbaram nos últimos 30 dias"),
    ).toBeInTheDocument();
  });
});
