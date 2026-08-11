/**
 * The facts about the company that the legal texts refer to.
 *
 * Defined ONCE so filling them in is one edit and not a hunt through prose. Every
 * value below marked TODO is a real-world fact nobody in this codebase can know —
 * leaving them as placeholders in the published text would be worse than leaving
 * them here, because a policy that names no controller identifies nobody.
 *
 * The published pages render a visible warning while any TODO remains, so this
 * cannot be forgotten into production.
 */

export const IDENTIDADE = {
  nomeFantasia: "Vale Desconto",
  /** TODO: razão social completa. */
  razaoSocial: "TODO — razão social",
  /** TODO: CNPJ. */
  cnpj: "TODO — CNPJ",
  /** TODO: endereço completo com CEP. */
  endereco: "TODO — endereço",
  /** Canal do titular (LGPD Art. 18) e do encarregado (Art. 41). */
  emailPrivacidade: "privacidade@valedesconto.com.br",
  emailSuporte: "suporte@valedesconto.com.br",
  /** TODO: nome do encarregado pelo tratamento de dados. */
  encarregado: "TODO — nome do encarregado",
  site: "https://valedesconto.com.br",
  /** TODO: comarca do foro eleito. */
  foro: "TODO — comarca",
} as const;

/** True while any real-world fact is still missing. Drives the visible warning. */
export const IDENTIDADE_INCOMPLETA = Object.values(IDENTIDADE).some((value) =>
  value.startsWith("TODO"),
);
