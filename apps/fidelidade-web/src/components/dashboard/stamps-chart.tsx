import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";

export type StampsByDay = { day: string; count: number };

/**
 * A bar per local day, drawn with divs rather than a charting library: the whole
 * app ships as one bundle to a lojista on mobile data, and 14 bars do not
 * justify a dependency.
 *
 * The API returns quiet days as zeros. Skipping them here would let a bad week
 * look like a busy one, so a zero-count day still renders as a visible baseline
 * sliver instead of nothing.
 */
export function StampsChart({ days }: { days: StampsByDay[] }) {
  const peak = days.reduce((max, entry) => Math.max(max, entry.count), 0);

  if (days.length === 0 || peak === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {copy.painel.chartEmpty}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex h-28 items-end justify-between gap-1">
          {days.map((entry) => {
            const ratio = entry.count / peak;
            // A "/" split reads as day/month to a Brazilian and needs no locale
            // machinery; the API already returns the date in the store's zone.
            const [, month, day] = entry.day.split("-");

            return (
              <div
                key={entry.day}
                // `h-full` is load-bearing: the bar's height is a PERCENTAGE, and
                // a percentage resolves against the parent's height. Without it
                // the column is content-sized, every bar computes to zero, and
                // the chart renders as a bare row of dates.
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                title={`${day}/${month}: ${entry.count}`}
              >
                <div
                  aria-hidden="true"
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(ratio * 100, 2)}%` }}
                />
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default StampsChart;
