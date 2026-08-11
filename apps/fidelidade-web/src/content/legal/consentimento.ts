/**
 * O texto do consentimento que o cliente final aceita na página de campanha.
 *
 * Mora aqui, e não solto dentro do componente, por um motivo prático: a LGPD
 * exige que o controlador consiga demonstrar o consentimento (art. 8º, §1º), e
 * demonstrar significa mostrar O QUE a pessoa leu, não apenas que ela marcou uma
 * caixa. Guardamos a versão junto com o carimbo de tempo; o texto de cada versão
 * fica registrado abaixo para sempre.
 *
 * REGRA: nunca edite o texto de uma versão já publicada. Crie a próxima versão,
 * aponte CONSENTIMENTO_ATUAL para ela, e deixe a antiga no histórico — senão os
 * registros antigos passam a apontar para palavras que ninguém leu.
 */

export type TextoDeConsentimento = {
  /** Identificador gravado no banco junto com o aceite. */
  version: string;
  /** Data em que esta versão entrou no ar. */
  since: string;
  /** O que aparece ao lado da caixa de marcar. */
  label: string;
  /** Linha de apoio, abaixo do label. */
  hint: string;
};

// `as const` on purpose: it keeps `version` a literal type, so the RPC client
// checks it against the versions the API actually accepts. Publishing a text the
// server does not know then fails the build instead of failing a customer.
const V1 = {
  version: "consentimento-cupom-v1",
  since: "2026-08-11",
  label:
    "Autorizo esta loja a guardar meu telefone para participar do programa de fidelidade e receber este cupom.",
  hint: "Você pode pedir a exclusão a qualquer momento, na loja ou pelo e-mail indicado na Política de Privacidade.",
} as const satisfies TextoDeConsentimento;

/** Histórico completo. Só cresce. */
export const CONSENTIMENTOS: TextoDeConsentimento[] = [V1];

/** A versão que vale hoje. É esta que o formulário exibe e grava. */
export const CONSENTIMENTO_ATUAL = V1;
