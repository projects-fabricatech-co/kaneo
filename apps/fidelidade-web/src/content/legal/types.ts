/**
 * Shape of a legal document.
 *
 * Structured rather than a blob of HTML for three reasons that matter later: a
 * section can be linked to (a support reply that says "see clause 4" needs an
 * anchor), a diff shows which clause changed, and the same renderer serves every
 * document so they cannot drift apart visually.
 */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type LegalSection = {
  /** Stable anchor. Never renumber one that has been published — links rot. */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  title: string;
  /** What the reader is: changes the tone the sections are written in. */
  audience: string;
  /** ISO date. Bump ONLY when the text changes in substance. */
  effectiveDate: string;
  summary: string;
  sections: LegalSection[];
};
