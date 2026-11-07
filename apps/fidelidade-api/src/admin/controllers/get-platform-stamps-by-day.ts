import { sql } from "drizzle-orm";
import db from "../../database";
import { stampTable } from "../../database/schema";
import { PLATFORM_TIMEZONE } from "./get-platform-metrics";

export const DEFAULT_PLATFORM_WINDOW = 30;

export type PlatformStampsByDay = {
  /** `YYYY-MM-DD` on `PLATFORM_TIMEZONE`'s calendar. */
  day: string;
  count: number;
};

/**
 * Stamps per day across every shop, oldest first.
 *
 * Same shape as the lojista's chart in `dashboard/controllers/get-stamps-by-day`
 * — `generate_series` LEFT JOINed to the stamps so a quiet day comes back as
 * zero instead of vanishing, and `count(stamps.id)` rather than `count(*)` so
 * the join's empty row does not score as one.
 *
 * It differs in exactly one way, and that difference is the whole reason this is
 * a separate controller rather than a parameter on the other one: the store's
 * timezone is replaced by the platform's single clock. There is no per-store
 * bucketing to do when the answer spans every store, and pretending otherwise
 * would double-count the hours where two shops' calendars disagree.
 */
async function getPlatformStampsByDay(
  days: number = DEFAULT_PLATFORM_WINDOW,
): Promise<PlatformStampsByDay[]> {
  // `::text` on every use: `at time zone` is overloaded on text and on interval,
  // and an untyped parameter leaves Postgres unable to choose.
  const timezone = sql`${PLATFORM_TIMEZONE}::text`;

  const { rows } = await db.execute<PlatformStampsByDay>(sql`
    select to_char(series.day, 'YYYY-MM-DD') as "day",
           count(${stampTable.id})::int as "count"
      from generate_series(
             date_trunc('day', now() at time zone ${timezone})
               - make_interval(days => ${days - 1}::int),
             date_trunc('day', now() at time zone ${timezone}),
             interval '1 day'
           ) as series(day)
      left join ${stampTable}
        on ${stampTable.voidedAt} is null
       and date_trunc('day', ${stampTable.createdAt} at time zone ${timezone}) = series.day
     group by series.day
     order by series.day
  `);

  return rows;
}

export default getPlatformStampsByDay;
