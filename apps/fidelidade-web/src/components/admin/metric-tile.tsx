import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MetricTileProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
};

/**
 * One number, in the console's own tile.
 *
 * Not `components/dashboard/stat-tiles`: that one's tile list is keyed to
 * `DashboardSummary`, so reusing it would mean widening a lojista-facing type to
 * carry MRR and churn. Two small components beat one that has to know about both
 * audiences.
 *
 * `tabular-nums` matters more here than it looks. These numbers refresh under
 * the reader, and proportional digits make a column jump sideways every time a
 * 1 becomes a 7 — the design system names a Numeric style for exactly this.
 *
 * No shadow, deliberately: the design system reserves elevation for menus,
 * modals and overlays, and a grid of floating cards is the first thing that
 * makes a dashboard look like a template.
 */
export function MetricTile({ label, value, hint, icon: Icon }: MetricTileProps) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
        </div>
        <span className="font-heading text-2xl font-extrabold tabular-nums tracking-tight">
          {value}
        </span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default MetricTile;
