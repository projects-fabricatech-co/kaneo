import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { stampTable, storeTable } from "../../database/schema";

export const DEFAULT_STAMPS_BY_DAY_WINDOW = 14;

export type StampsByDay = {
  /** `YYYY-MM-DD` on the store's own calendar, not on UTC's. */
  day: string;
  count: number;
};

/**
 * The little bar chart on the painel: one row per local day, oldest first.
 *
 * `generate_series` builds the calendar and the stamps are LEFT JOINed onto it,
 * so a day nobody walked in still comes back as `count: 0`. Grouping the stamps
 * table alone would simply omit those days, and the chart would then draw a dead
 * Tuesday as if it had never happened — the flat stretch is exactly the thing
 * the lojista opened the chart to look at.
 *
 * `count(stamps.id)` and not `count(*)`: on a day with no match the left join
 * still yields one row, and `count(*)` would score that row as 1.
 *
 * The timezone is fetched first and passed in as a parameter, unlike
 * `get-dashboard` which correlates against `stores.timezone` directly. Putting
 * `stores` in this query's FROM would make `id` and `created_at` ambiguous
 * between the two tables; the bucketing is still done by Postgres either way,
 * which is the part that matters.
 */
async function getStampsByDay(
  storeId: string,
  days: number = DEFAULT_STAMPS_BY_DAY_WINDOW,
): Promise<StampsByDay[]> {
  const [store] = await db
    .select({ timezone: storeTable.timezone })
    .from(storeTable)
    .where(eq(storeTable.id, storeId))
    .limit(1);

  if (!store) {
    throw new HTTPException(404, { message: "Loja não encontrada" });
  }

  // `::text` on every use of the parameter: `at time zone` is overloaded on text
  // and on interval, and an untyped parameter leaves Postgres unable to choose.
  const timezone = sql`${store.timezone}::text`;

  const { rows } = await db.execute<StampsByDay>(sql`
    select to_char(series.day, 'YYYY-MM-DD') as "day",
           count(${stampTable.id})::int as "count"
      from generate_series(
             date_trunc('day', now() at time zone ${timezone})
               - make_interval(days => ${days - 1}::int),
             date_trunc('day', now() at time zone ${timezone}),
             interval '1 day'
           ) as series(day)
      left join ${stampTable}
        on ${stampTable.storeId} = ${storeId}
       and ${stampTable.voidedAt} is null
       and date_trunc('day', ${stampTable.createdAt} at time zone ${timezone}) = series.day
     group by series.day
     order by series.day
  `);

  return rows;
}

export default getStampsByDay;
