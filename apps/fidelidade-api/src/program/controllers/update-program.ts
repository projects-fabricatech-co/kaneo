import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { programTable } from "../../database/schema";
import { isUniqueViolation } from "../../utils/unique-violation";
import { duplicateProgramNameError } from "./create-program";
import getProgram from "./get-program";

export type UpdateProgramInput = {
  name?: string;
  rewardDescription?: string;
  stampsRequired?: number;
  rewardValidityDays?: number;
  cooldownMinutes?: number;
  cardColor?: string;
  cardTextColor?: string;
  logoUrl?: string | null;
  status?: "active" | "archived";
};

/**
 * Raising `stampsRequired` here does NOT move the goal for cards already in
 * flight: `cards.stampsRequired` is a snapshot taken when the card was created.
 */
async function updateProgram(
  storeId: string,
  programId: string,
  input: UpdateProgramInput,
) {
  const values: Partial<typeof programTable.$inferInsert> = {};

  if (input.name !== undefined) {
    values.name = input.name.trim();
  }

  if (input.rewardDescription !== undefined) {
    values.rewardDescription = input.rewardDescription.trim();
  }

  if (input.stampsRequired !== undefined) {
    values.stampsRequired = input.stampsRequired;
  }

  if (input.rewardValidityDays !== undefined) {
    values.rewardValidityDays = input.rewardValidityDays;
  }

  if (input.cooldownMinutes !== undefined) {
    values.cooldownMinutes = input.cooldownMinutes;
  }

  if (input.cardColor !== undefined) {
    values.cardColor = input.cardColor;
  }

  if (input.cardTextColor !== undefined) {
    values.cardTextColor = input.cardTextColor;
  }

  if (input.logoUrl !== undefined) {
    values.logoUrl = input.logoUrl;
  }

  if (input.status !== undefined) {
    values.status = input.status;
  }

  if (Object.keys(values).length === 0) {
    return getProgram(storeId, programId);
  }

  try {
    const [updated] = await db
      .update(programTable)
      .set(values)
      .where(
        and(eq(programTable.id, programId), eq(programTable.storeId, storeId)),
      )
      .returning();

    if (!updated) {
      throw new HTTPException(404, { message: "Programa não encontrado" });
    }

    return updated;
  } catch (error) {
    if (isUniqueViolation(error, "programs_store_name_active_unique")) {
      throw duplicateProgramNameError();
    }

    throw error;
  }
}

export default updateProgram;
