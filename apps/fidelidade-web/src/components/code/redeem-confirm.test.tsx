import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RedeemConfirm, type ValidatedCode } from "./redeem-confirm";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function build(overrides: Partial<ValidatedCode> = {}): ValidatedCode {
  return {
    kind: "reward",
    code: "P4KJ9MN",
    description: "Um café expresso grátis",
    expiresAt: null,
    ...overrides,
  };
}

describe("RedeemConfirm", () => {
  it("shows what the lojista is about to hand over", () => {
    render(
      <RedeemConfirm
        validated={build()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Você vai entregar:")).toBeInTheDocument();
    expect(screen.getByText("Um café expresso grátis")).toBeInTheDocument();
    expect(screen.getByText("P4KJ9MN")).toBeInTheDocument();
  });

  it("labels a reward and a coupon differently", () => {
    const { unmount } = render(
      <RedeemConfirm
        validated={build({ kind: "reward" })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Prêmio")).toBeInTheDocument();
    unmount();

    render(
      <RedeemConfirm
        validated={build({ kind: "coupon" })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Cupom")).toBeInTheDocument();
  });

  it("says so when there is no expiry", () => {
    render(
      <RedeemConfirm
        validated={build({ expiresAt: null })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Sem prazo de validade")).toBeInTheDocument();
  });

  it("shows the expiry date when there is one", () => {
    render(
      <RedeemConfirm
        validated={build({ expiresAt: "2026-12-25T12:00:00.000Z" })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Válido até/)).toBeInTheDocument();
  });

  it("confirms and cancels through their handlers", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <RedeemConfirm
        validated={build()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Confirmar resgate/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("blocks cancelling while the redemption is in flight", () => {
    // Redemption is irreversible; letting the lojista cancel mid-request would
    // leave them believing nothing happened.
    render(
      <RedeemConfirm
        validated={build()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirming
      />,
    );
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeDisabled();
  });
});
