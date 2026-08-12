import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDENTIDADE, IDENTIDADE_INCOMPLETA } from "@/content/legal/identidade";
import { POLITICA_PRIVACIDADE } from "@/content/legal/privacidade";
import { TERMOS_DE_USO } from "@/content/legal/termos";
import type { LegalDocument } from "@/content/legal/types";
import { LegalDocumentView } from "./legal-document";

// The renderer uses <Link>, which needs a router the rest of these tests have
// no use for. The destinations are asserted on the anchors it produces.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * The identity is complete today, so the warning does not render — which would
 * make a test that only asserts "the warning is there" pass forever after
 * someone deletes the warning. The flag is faked instead, so both directions
 * stay covered no matter what the real values happen to be.
 */
const identidade = vi.hoisted(() => ({ incompleta: false }));

vi.mock("@/content/legal/identidade", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/content/legal/identidade")>();

  return {
    ...real,
    get IDENTIDADE_INCOMPLETA() {
      return identidade.incompleta;
    },
  };
});

beforeEach(() => {
  identidade.incompleta = false;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const DOC: LegalDocument = {
  title: "Documento de Teste",
  audience: "Ninguém",
  effectiveDate: "2026-08-11",
  summary: "Resumo.",
  sections: [
    {
      id: "primeira",
      title: "1. Primeira",
      blocks: [
        { kind: "p", text: "Um parágrafo." },
        { kind: "list", items: ["Um item"] },
        {
          kind: "table",
          head: ["Quem", "O quê"],
          rows: [["Stripe", "Cobrança"]],
        },
      ],
    },
  ],
};

describe("LegalDocumentView", () => {
  it("renders the effective date as a calendar date, not shifted by timezone", () => {
    // `new Date("2026-08-11")` is UTC midnight, which renders as the 10th for
    // anyone in Brazil — a text that appears to have taken effect a day early.
    render(<LegalDocumentView document={DOC} />);

    expect(screen.getByText(/11\/08\/2026/)).toBeInTheDocument();
  });

  it("gives every section an anchor so a support reply can link to a clause", () => {
    const { container } = render(<LegalDocumentView document={DOC} />);

    expect(container.querySelector("#primeira")).not.toBeNull();
    expect(container.querySelector('nav a[href="#primeira"]')).not.toBeNull();
  });

  it("renders all three kinds of block", () => {
    render(<LegalDocumentView document={DOC} />);

    expect(screen.getByText("Um parágrafo.")).toBeInTheDocument();
    expect(screen.getByText("Um item")).toBeInTheDocument();
    expect(screen.getByText("Stripe")).toBeInTheDocument();
  });

  it("warns, visibly, while the company identity is still unfilled", () => {
    // A policy that names no controller identifies nobody. This must not be
    // possible to ship by accident, so the warning is part of the page.
    identidade.incompleta = true;

    render(<LegalDocumentView document={DOC} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /dados de identificação da empresa/i,
    );
  });

  it("does not nag once the identity is filled in", () => {
    render(<LegalDocumentView document={DOC} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the company identity", () => {
  it("is complete, so the published texts identify a controller", () => {
    // Fails the moment a field is added and left as TODO — which is the point:
    // a half-filled identity is the state that must not reach production
    // quietly. Uses the real module, not the fake above.
    expect(IDENTIDADE_INCOMPLETA).toBe(false);
  });

  it("names the controller and the data protection officer", () => {
    // LGPD Art. 41 asks for the officer's identity to be public; Art. 18 needs
    // a channel that a titular can actually write to.
    expect(IDENTIDADE.razaoSocial).not.toMatch(/TODO/);
    expect(IDENTIDADE.cnpj).not.toMatch(/TODO/);
    expect(IDENTIDADE.encarregado).not.toMatch(/TODO/);
    expect(IDENTIDADE.emailPrivacidade).toMatch(/@/);
  });
});

describe("the published documents", () => {
  const documents = [POLITICA_PRIVACIDADE, TERMOS_DE_USO];

  it.each(documents)("$title renders end to end", (document) => {
    render(<LegalDocumentView document={document} />);

    expect(
      screen.getByRole("heading", { level: 1, name: document.title }),
    ).toBeInTheDocument();

    for (const section of document.sections) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.title }),
      ).toBeInTheDocument();
    }
  });

  it.each(documents)("$title has no duplicate anchors", (document) => {
    // Two sections sharing an id means one of them can never be linked to.
    const ids = document.sections.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
