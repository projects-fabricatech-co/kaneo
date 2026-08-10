import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicCard } from "@/types/public-card";
import { PublicCardView } from "./public-card-view";

// The QR renders through a dynamic import of `qrcode` inside an effect, which
// jsdom would resolve after the assertions. The token it encodes is asserted on
// the server side.
vi.mock("./qr-code", () => ({
  QrCode: ({ label }: { label: string }) => <div data-testid="qr">{label}</div>,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function buildStore(overrides: Partial<PublicCard["store"]> = {}) {
  return {
    name: "Padaria da Esquina",
    logoUrl: null,
    brandColor: "#D93825",
    brandTextColor: "#FFFFFF",
    city: "São Paulo",
    whatsapp: null,
    ...overrides,
  };
}

function buildEntry(overrides: Partial<PublicCard["cards"][number]> = {}) {
  return {
    programName: "Cartão Fidelidade",
    rewardDescription: "Um café expresso grátis",
    stampsCount: 3,
    stampsRequired: 10,
    cardColor: "#4F46E5",
    cardTextColor: "#FFFFFF",
    status: "active" as const,
    cycle: 1,
    stampedAt: [],
    ...overrides,
  };
}

function build(overrides: Partial<PublicCard> = {}): PublicCard {
  return {
    token: "tok_abcdefghijklmnopqrstuv",
    store: buildStore(),
    customer: { firstName: "Maria", phoneMasked: "(11) *****-4321" },
    cards: [buildEntry()],
    rewards: [],
    coupons: [],
    ...overrides,
  };
}

describe("PublicCardView", () => {
  it("shows the store name and the customer's first name", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.getByText("Padaria da Esquina")).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
  });

  it("shows progress and how many stamps are left", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.getByText("3 de 10 carimbos")).toBeInTheDocument();
    expect(screen.getByText("Faltam 7 carimbos")).toBeInTheDocument();
  });

  it("uses the singular when one stamp is left", () => {
    const data = build({ cards: [buildEntry({ stampsCount: 9 })] });
    render(<PublicCardView data={data} />);
    expect(screen.getByText("Falta 1 carimbo!")).toBeInTheDocument();
  });

  it("announces a complete card", () => {
    const data = build({
      cards: [buildEntry({ stampsCount: 10, status: "completed" })],
    });
    render(<PublicCardView data={data} />);
    expect(screen.getByText("Cartão completo!")).toBeInTheDocument();
  });

  it("shows the redemption code prominently when a reward exists", () => {
    const data = build({
      rewards: [
        {
          code: "P4KJ9M",
          description: "Um café expresso grátis",
          expiresAt: null,
        },
      ],
    });
    render(<PublicCardView data={data} />);
    expect(screen.getByText("P4KJ9M")).toBeInTheDocument();
    expect(screen.getByText("Mostre este código na loja")).toBeInTheDocument();
  });

  it("does not render a reward section when there is none", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.queryByText("Mostre este código na loja")).toBeNull();
  });

  it("says so when there are no active coupons", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.getByText("Nenhum cupom ativo agora.")).toBeInTheDocument();
  });

  it("shows a coupon with its discount label and the customer's code", () => {
    const data = build({
      coupons: [
        {
          title: "Aniversário da loja",
          description: null,
          discountLabel: "15% OFF",
          endsAt: null,
          myCode: "C7XQ2B",
          myCodeExpiresAt: null,
        },
      ],
    });
    render(<PublicCardView data={data} />);
    expect(screen.getByText("15% OFF")).toBeInTheDocument();
    expect(screen.getByText("C7XQ2B")).toBeInTheDocument();
  });

  it("renders the identification QR", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.getByTestId("qr")).toBeInTheDocument();
  });

  it("never renders a full phone number", () => {
    // The masked value is what the server sends; a regression that leaked the
    // raw phone would show up as 11 consecutive digits somewhere on the page.
    const { container } = render(<PublicCardView data={build()} />);
    expect(container.textContent ?? "").not.toMatch(/\d{11}/);
    expect(screen.getByText(/\(11\) \*\*\*\*\*-4321/)).toBeInTheDocument();
  });

  it("falls back to an initial when the store has no logo", () => {
    render(<PublicCardView data={build()} />);
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("renders the logo when the plan allows branding", () => {
    const data = build({
      store: buildStore({ logoUrl: "https://cdn.test/logo.png" }),
    });
    const { container } = render(<PublicCardView data={data} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.test/logo.png",
    );
  });

  it("renders every card when a customer is in more than one program", () => {
    const data = build({
      cards: [
        buildEntry(),
        buildEntry({ programName: "Clube do Pão", cycle: 2, stampsCount: 1 }),
      ],
    });
    render(<PublicCardView data={data} />);
    expect(screen.getByText("Cartão Fidelidade")).toBeInTheDocument();
    expect(screen.getByText("Clube do Pão")).toBeInTheDocument();
  });
});
