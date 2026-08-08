import type db from ".";

type TransactionCallback = Parameters<(typeof db)["transaction"]>[0];

/**
 * Either the root database handle or a transaction handle. Controllers take this
 * so a helper can be called both standalone and inside `db.transaction()`.
 */
export type DatabaseExecutor = typeof db | Parameters<TransactionCallback>[0];
