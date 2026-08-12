import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { programTable } from "../../database/schema";
import { assertWithinLimit } from "../../plans/assert-within-limit";
import { resolvePlanForStore } from "../../plans/resolve-plan";
import { isUniqueViolation } from "../../utils/unique-violation";

export type CreateProgramInput = {
  name: string;
  rewardDescription: string;
  stampsRequired?: number;
  rewardValidityDays?: number;
  cooldownMinutes?: number;
  cardColor?: string;
  cardTextColor?: string;
  logoUrl?: string | null;
};

export function duplicateProgramNameError(): HTTPException {
  return new HTTPException(409, {
    message: "Já existe um programa ativo com este nome",
  });
}

async function createProgram(storeId: string, input: CreateProgramInput) {
  const { plan, limits } = await resolvePlanForStore(storeId);

  try {
    return await db.transaction(async (tx) => {
      await assertWithinLimit(tx, {
        lockKey: `limit:programs:${storeId}`,
        limit: limits.maxProgramsPerStore,
        code: "maxProgramsPerStore",
        plan,
        current: async () => {
          // Archived programs do not count: a shop that retired a campaign gets
          // its slot back.
          const [row] = await tx
            .select({ value: count() })
            .from(programTable)
            .where(
              and(
                eq(programTable.storeId, storeId),
                eq(programTable.status, "active"),
              ),
            );

          return Number(row?.value ?? 0);
        },
      });

      const [created] = await tx
        .insert(programTable)
        .values({
          storeId,
          name: input.name.trim(),
          rewardDescription: input.rewardDescription.trim(),
          logoUrl: input.logoUrl ?? null,
          ...(input.stampsRequired !== undefined
            ? { stampsRequired: input.stampsRequired }
            : {}),
          ...(input.rewardValidityDays !== undefined
            ? { rewardValidityDays: input.rewardValidityDays }
            : {}),
          ...(input.cooldownMinutes !== undefined
            ? { cooldownMinutes: input.cooldownMinutes }
            : {}),
          ...(input.cardColor ? { cardColor: input.cardColor } : {}),
          ...(input.cardTextColor
            ? { cardTextColor: input.cardTextColor }
            : {}),
        })
        .returning();

      if (!created) {
        throw new HTTPException(500, {
          message: "Não foi possível criar o programa",
        });
      }

      return created;
    });
  } catch (error) {
    // `programs_store_name_active_unique` is a PARTIAL index, so the conflict is
    // caught here rather than with `onConflictDoNothing`, and translated into a
    // 409 the shop owner can act on.
    if (isUniqueViolation(error, "programs_store_name_active_unique")) {
      throw duplicateProgramNameError();
    }

    throw error;
  }
}

export default createProgram;
