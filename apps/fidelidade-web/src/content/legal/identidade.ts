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
  razaoSocial: "D M Tecnologia e Inovação Ltda",
  cnpj: "42.213.670/0001-36",
  /** Endereço publicado em fabricatech.co, a marca da mesma empresa. */
  endereco:
    "Tv. São José, 455 — Navegantes, Porto Alegre/RS, CEP 90240-200, Brasil",
  /**
   * Canal do titular (LGPD Art. 18) e do encarregado (Art. 41), mais o suporte
   * ao lojista. Uma caixa só, que EXISTE e é lida — melhor que três endereços
   * bonitos que ninguém atende, porque a política promete resposta em 15 dias.
   *
   * Se um dia virarem caixas próprias em valedesconto.com.br, troque aqui: o
   * texto inteiro lê deste arquivo.
   */
  emailPrivacidade: "contato@fabricatech.co",
  emailSuporte: "contato@fabricatech.co",
  /** TODO: nome do encarregado pelo tratamento de dados (LGPD Art. 41). */
  encarregado: "TODO — nome do encarregado",
  site: "https://valedesconto.com.br",
  /** Derivado da sede: comarca do endereço acima. */
  foro: "Porto Alegre, Rio Grande do Sul",
} as const;

/** True while any real-world fact is still missing. Drives the visible warning. */
export const IDENTIDADE_INCOMPLETA = Object.values(IDENTIDADE).some((value) =>
  value.startsWith("TODO"),
);
