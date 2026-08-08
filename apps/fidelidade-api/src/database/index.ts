import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accountTableRelations,
  cardTableRelations,
  couponRedemptionTableRelations,
  couponTableRelations,
  customerTableRelations,
  programTableRelations,
  rewardTableRelations,
  sessionTableRelations,
  stampTableRelations,
  storeMemberTableRelations,
  storeTableRelations,
  subscriptionTableRelations,
  userTableRelations,
  verificationTableRelations,
} from "./relations";
import { resolveDatabaseConnectionString } from "./resolve-database-url";
import {
  accountTable,
  cardTable,
  couponRedemptionTable,
  couponTable,
  customerTable,
  programTable,
  rewardTable,
  sessionTable,
  stampTable,
  storeMemberTable,
  storeTable,
  stripeEventTable,
  subscriptionTable,
  userTable,
  verificationTable,
} from "./schema";

config();

export const schema = {
  accountTable,
  cardTable,
  couponRedemptionTable,
  couponTable,
  customerTable,
  programTable,
  rewardTable,
  sessionTable,
  stampTable,
  storeMemberTable,
  storeTable,
  stripeEventTable,
  subscriptionTable,
  userTable,
  verificationTable,
  accountTableRelations,
  cardTableRelations,
  couponRedemptionTableRelations,
  couponTableRelations,
  customerTableRelations,
  programTableRelations,
  rewardTableRelations,
  sessionTableRelations,
  stampTableRelations,
  storeMemberTableRelations,
  storeTableRelations,
  subscriptionTableRelations,
  userTableRelations,
  verificationTableRelations,
};

type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let dbInstance: DatabaseInstance | undefined;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveDatabaseConnectionString(),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });
  }

  return pool;
}

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getDatabasePool(), {
      schema,
    });
  }

  return dbInstance;
}

/**
 * Lazy proxy so importing a controller (or the app itself) never opens a
 * connection — the unit test suite relies on this.
 */
const db = new Proxy({} as DatabaseInstance, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDatabase(), property, receiver);

    if (typeof value === "function") {
      return value.bind(getDatabase());
    }

    return value;
  },
});

export default db;
