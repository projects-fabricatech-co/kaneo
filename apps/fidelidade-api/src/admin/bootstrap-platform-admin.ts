import { eq, isNull, sql } from "drizzle-orm";
import db from "../database";
import { platformAdminTable, userTable } from "../database/schema";
import { acquireAdvisoryLock } from "../utils/advisory-lock";
import { recordAdminAction } from "./record-admin-action";

const BOOTSTRAP_LOCK_KEY = "fidelidade:platform-admin-bootstrap";

/**
 * Promotes the first administrator, exactly once.
 *
 * `platform_admins` is the truth; this only solves the chicken-and-egg of the
 * first deploy, where the console is the only way to grant access and nobody can
 * open it. Once ANY live grant exists the environment variable does nothing —
 * that condition is what keeps it from being a permanent back door. Someone who
 * later sets the variable to their own address on a running system gets no
 * effect at all.
 *
 * An address with no user is left alone with a warning rather than treated as an
 * error: the person has to sign up first, and refusing to boot the API over it
 * would make an ordinary ordering mistake into an outage.
 *
 * The advisory lock covers the boot of two instances at the same moment, where
 * both would read an empty table and both would insert. The unique on `userId`
 * would catch two identical addresses, but not two different ones.
 */
export async function ensurePlatformAdminBootstrap(): Promise<void> {
  const email = process.env.FIDELIDADE_PLATFORM_ADMIN_EMAIL?.trim();

  if (!email) {
    return;
  }

  await db.transaction(async (tx) => {
    await acquireAdvisoryLock(tx, BOOTSTRAP_LOCK_KEY);

    const [existing] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(platformAdminTable)
      .where(isNull(platformAdminTable.revokedAt));

    if ((existing?.value ?? 0) > 0) {
      return;
    }

    const [user] = await tx
      .select({ id: userTable.id, email: userTable.email })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (!user) {
      console.warn(
        `fidelidade: FIDELIDADE_PLATFORM_ADMIN_EMAIL aponta para ${email}, que ainda não tem conta. Cadastre-se e reinicie a API.`,
      );
      return;
    }

    await tx.insert(platformAdminTable).values({ userId: user.id });

    // In the same transaction as the grant. A promotion that happened without a
    // log row, or a log row for a promotion that rolled back, are both records
    // that lie.
    await recordAdminAction(
      {
        adminUserId: user.id,
        adminEmail: user.email,
        action: "admin.bootstrap",
        targetType: "user",
        targetId: user.id,
        reason:
          "Primeiro administrador, promovido por FIDELIDADE_PLATFORM_ADMIN_EMAIL",
      },
      tx,
    );

    console.log(
      `fidelidade: ${email} promovido a administrador da plataforma.`,
    );
  });
}
