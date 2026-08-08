import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StampGrid } from "./stamp-grid";

afterEach(() => {
  cleanup();
  // Base UI portals leak between tests.
  document.body.innerHTML = "";
});

function slots(container: HTMLElement) {
  return Array.from(container.querySelectorAll("li"));
}

describe("StampGrid", () => {
  it("renders one slot per stamp in the goal", () => {
    const { container } = render(<StampGrid count={0} goal={10} />);
    expect(slots(container)).toHaveLength(10);
  });

  it("fills exactly as many slots as stamps given", () => {
    const { container } = render(<StampGrid count={3} goal={10} />);
    const filled = slots(container).filter(
      (slot) => slot.querySelector("svg") !== null,
    );
    expect(filled).toHaveLength(3);
  });

  it("numbers the empty slots so the customer can count what is left", () => {
    render(<StampGrid count={2} goal={5} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("fills every slot on a complete card", () => {
    const { container } = render(<StampGrid count={10} goal={10} />);
    const filled = slots(container).filter(
      (slot) => slot.querySelector("svg") !== null,
    );
    expect(filled).toHaveLength(10);
  });

  it("never overflows when the count exceeds the goal", () => {
    // Can happen transiently if the goal was lowered after stamps accrued.
    const { container } = render(<StampGrid count={14} goal={10} />);
    const all = slots(container);
    expect(all).toHaveLength(10);
    expect(all.filter((slot) => slot.querySelector("svg"))).toHaveLength(10);
  });

  it("treats a negative count as zero", () => {
    const { container } = render(<StampGrid count={-3} goal={6} />);
    expect(
      slots(container).filter((slot) => slot.querySelector("svg")),
    ).toHaveLength(0);
  });

  it("still renders a slot when the goal is degenerate", () => {
    const { container } = render(<StampGrid count={0} goal={0} />);
    expect(slots(container)).toHaveLength(1);
  });

  it("is hidden from assistive tech, since the text label carries the count", () => {
    const { container } = render(<StampGrid count={3} goal={10} />);
    expect(container.querySelector("ul")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
