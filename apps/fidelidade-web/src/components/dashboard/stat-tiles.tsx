import type { LucideIcon } from "lucide-react";
import { Gift, Stamp, Ticket, TrendingUp, UserPlus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatNumber } from "@/lib/format";

export type DashboardSummary = {
  stampsToday: number;
  stampsWeek: number;
  activeCustomers: number;
  newCustomersWeek: number;
  cardsNearGoal: number;
  pendingRewards: number;
  couponsActive: number;
};

type Tile = {
  key: keyof DashboardSummary;
  label: string;
  hint?: string;
  icon: LucideIcon;
};

/**
 * Order is the lojista's order of interest, not the API's: what happened today
 * comes first, then who is close to a prize (the number that tells them who to
 * call), then the slower counters.
 */
const TILES: Tile[] = [
  { key: "stampsToday", label: copy.painel.stampsToday, icon: Stamp },
  { key: "stampsWeek", label: copy.painel.stampsWeek, icon: TrendingUp },
  {
    key: "cardsNearGoal",
    label: copy.painel.cardsNearGoal,
    hint: copy.painel.cardsNearGoalHint,
    icon: Gift,
  },
  { key: "pendingRewards", label: copy.painel.pendingRewards, icon: Gift },
  {
    key: "activeCustomers",
    label: copy.painel.activeCustomers,
    hint: copy.painel.activeCustomersHint,
    icon: Users,
  },
  {
    key: "newCustomersWeek",
    label: copy.painel.newCustomersWeek,
    icon: UserPlus,
  },
  { key: "couponsActive", label: copy.painel.couponsActive, icon: Ticket },
];

export function StatTiles({ summary }: { summary: DashboardSummary }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {TILES.map((tile) => {
        const Icon = tile.icon;

        return (
          <li key={tile.key}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-1 py-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="text-xs font-medium">{tile.label}</span>
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatNumber(summary[tile.key])}
                </p>
                {tile.hint ? (
                  <p className="text-xs text-muted-foreground">{tile.hint}</p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default StatTiles;
