import { HTTPException } from "hono/http-exception";
import { PLAN_LABELS, type PlanId } from "./limits";

export type PlanLimitCode =
  | "maxStores"
  | "maxProgramsPerStore"
  | "maxCustomersPerStore"
  | "maxMembersPerStore";

function buildMessage(code: PlanLimitCode, limit: number, plan: PlanId) {
  const planLabel = PLAN_LABELS[plan];

  switch (code) {
    case "maxStores":
      return `Seu plano ${planLabel} permite até ${limit} ${
        limit === 1 ? "loja" : "lojas"
      }. Para cadastrar outra loja, faça upgrade.`;

    case "maxProgramsPerStore":
      return `Seu plano ${planLabel} permite até ${limit} ${
        limit === 1 ? "programa de fidelidade" : "programas de fidelidade"
      } por loja. Para criar outro programa, faça upgrade.`;

    case "maxCustomersPerStore":
      return `Seu plano ${planLabel} permite até ${limit} clientes. Você mantém seus clientes atuais; para cadastrar novos, faça upgrade.`;

    case "maxMembersPerStore":
      return `Seu plano ${planLabel} permite até ${limit} ${
        limit === 1 ? "pessoa na equipe" : "pessoas na equipe"
      }. Para convidar mais alguém, faça upgrade.`;

    default:
      return `Seu plano ${planLabel} atingiu o limite. Para continuar, faça upgrade.`;
  }
}

/**
 * 402 Payment Required, not 403 — 403 stays reserved for role violations, so the
 * web client can tell "you need to pay" apart from "you are not the owner".
 *
 * The body is built with the `res` option rather than `message`: Hono renders
 * `message` as PLAIN TEXT, and the client needs a JSON body to route the user
 * into the upgrade sheet.
 */
export function planLimitError(
  code: PlanLimitCode,
  limit: number,
  used: number,
  plan: PlanId,
): HTTPException {
  return new HTTPException(402, {
    res: Response.json(
      {
        error: "plan_limit_exceeded",
        limit: code,
        max: limit,
        used,
        plan,
        message: buildMessage(code, limit, plan),
      },
      { status: 402 },
    ),
  });
}

export function planFeatureError(
  feature: "coupons" | "branding" | "reports",
  plan: PlanId,
): HTTPException {
  const featureLabels: Record<typeof feature, string> = {
    coupons: "Cupons e campanhas",
    branding: "Personalização da marca",
    reports: "Relatórios avançados",
  };

  return new HTTPException(402, {
    res: Response.json(
      {
        error: "plan_feature_unavailable",
        limit: feature,
        plan,
        message: `${featureLabels[feature]} não está disponível no plano ${PLAN_LABELS[plan]}. Faça upgrade para liberar.`,
      },
      { status: 402 },
    ),
  });
}
