import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UsagePanel, type UsageSubscription } from "./usage-panel";

afterEach(cleanup);

const base: UsageSubscription = {
  planLabel: "Grátis",
  limits: {
    maxStores: 1,
    maxCustomersPerStore: 50,
    maxMembersPerStore: 1,
  },
  usage: { stores: 1, customers: 12, members: 1 },
};

describe("UsagePanel", () => {
  it("shows usage against each ceiling", () => {
    render(<UsagePanel subscription={base} />);
    expect(screen.getByText("12 / 50")).toBeInTheDocument();
  });

  it("says ilimitado rather than 0 when there is no ceiling", () => {
    // `null` is the API's word for unlimited. Rendering it as a number would
    // tell a paying lojista the exact opposite of the truth.
    render(
      <UsagePanel
        subscription={{
          ...base,
          planLabel: "Essencial",
          limits: { ...base.limits, maxCustomersPerStore: null },
          usage: { ...base.usage, customers: 843 },
        }}
      />,
    );

    expect(screen.getByText("843 / ilimitado")).toBeInTheDocument();
  });

  it("marks a ceiling that has been reached", () => {
    render(
      <UsagePanel
        subscription={{ ...base, usage: { ...base.usage, customers: 50 } }}
      />,
    );

    expect(screen.getByText("50 / 50").className).toContain("destructive");
  });

  it("does not mark a ceiling that still has room", () => {
    render(<UsagePanel subscription={base} />);
    expect(screen.getByText("12 / 50").className).not.toContain("destructive");
  });

  it("names the plan in force", () => {
    render(<UsagePanel subscription={{ ...base, planLabel: "Pro" }} />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});
