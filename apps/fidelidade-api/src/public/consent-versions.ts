/**
 * The consent texts the server will accept a claim for.
 *
 * The words themselves live in the web app (`content/legal/consentimento.ts`);
 * what lives here is the list of identifiers that are real. Without this the
 * client could post any string and the consent ledger would record agreement to
 * a text that never existed — which is worse than recording nothing, because it
 * looks like proof.
 *
 * When a new version is published: add it here FIRST and deploy, then point the
 * web app at it. Never remove an old one — rows already reference it, and a
 * returning claimer may still be running a cached bundle.
 */
export const CONSENT_VERSIONS = ["consentimento-cupom-v1"] as const;

export type ConsentVersion = (typeof CONSENT_VERSIONS)[number];
