import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type StampGridProps = {
  count: number;
  goal: number;
  /** Index of the stamp just added, so only that one animates. */
  justStampedIndex?: number | null;
  className?: string;
};

/**
 * The stamp card itself. Columns adapt to the goal so a 6-stamp and a 20-stamp
 * card both stay readable on a phone without scrolling.
 */
function columnsFor(goal: number): string {
  if (goal <= 6) return "grid-cols-3";
  if (goal <= 10) return "grid-cols-5";
  if (goal <= 12) return "grid-cols-4";
  return "grid-cols-5";
}

export function StampGrid({
  count,
  goal,
  justStampedIndex = null,
  className,
}: StampGridProps) {
  const safeGoal = Math.max(1, goal);
  const filled = Math.min(Math.max(0, count), safeGoal);

  return (
    <ul
      className={cn("grid gap-2.5", columnsFor(safeGoal), className)}
      // The textual "N de M" label next to the grid carries the real
      // information, so the grid is decorative to assistive tech.
      aria-hidden="true"
    >
      {Array.from({ length: safeGoal }, (_, index) => ({
        position: index,
        isFilled: index < filled,
        isNew: justStampedIndex === index,
      })).map(({ position, isFilled, isNew }) => {
        return (
          <li
            // Position IS the identity here: the slots are anonymous and
            // ordered, and the list only ever grows or shrinks at the end.
            key={`slot-${position}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full border-2 transition-colors",
              isFilled
                ? "border-transparent bg-[var(--stamp-fill,var(--color-primary))] text-[var(--stamp-on-fill,var(--color-primary-foreground))]"
                : "border-dashed border-current/25 text-current/30",
              isNew && "motion-safe:animate-in motion-safe:zoom-in-50",
            )}
          >
            {isFilled ? (
              <Check className="size-1/2" strokeWidth={3} />
            ) : (
              <span className="text-xs font-medium">{position + 1}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default StampGrid;
