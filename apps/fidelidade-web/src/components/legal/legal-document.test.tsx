import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    render(<LegalDocumentView document={DOC} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /dados de identificação da empresa/i,
    );
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
