import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StampsChart } from "./stamps-chart";

afterEach(cleanup);

describe("StampsChart", () => {
  it("draws one column per day, including the quiet ones", () => {
    render(
      <StampsChart
        days={[
          { day: "2026-08-07", count: 4 },
          { day: "2026-08-08", count: 0 },
          { day: "2026-08-09", count: 9 },
        ]}
      />,
    );

    expect(screen.getByTitle("07/08: 4")).toBeInTheDocument();
    expect(screen.getByTitle("08/08: 0")).toBeInTheDocument();
    expect(screen.getByTitle("09/08: 9")).toBeInTheDocument();
  });

  it("scales the bars against the busiest day", () => {
    const { container } = render(
      <StampsChart
        days={[
          { day: "2026-08-08", count: 5 },
          { day: "2026-08-09", count: 10 },
        ]}
      />,
    );

    const bars = container.querySelectorAll<HTMLElement>(
      "[aria-hidden='true']",
    );
    expect(bars[0]?.style.height).toBe("50%");
    expect(bars[1]?.style.height).toBe("100%");
  });

  it("keeps a zero day visible instead of collapsing it to nothing", () => {
    const { container } = render(
      <StampsChart
        days={[
          { day: "2026-08-08", count: 0 },
          { day: "2026-08-09", count: 10 },
        ]}
      />,
    );

    const bars = container.querySelectorAll<HTMLElement>(
      "[aria-hidden='true']",
    );
    expect(bars[0]?.style.height).toBe("2%");
  });

  it("says so when the whole window is empty", () => {
    render(
      <StampsChart
        days={[
          { day: "2026-08-08", count: 0 },
          { day: "2026-08-09", count: 0 },
        ]}
      />,
    );

    expect(
      screen.getByText("Nenhum carimbo nos últimos 14 dias."),
    ).toBeInTheDocument();
  });
});
