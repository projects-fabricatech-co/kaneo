import { Check, Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The stamp is the product's proprietary element, so the landing shows the real
 * thing rather than an illustration of one.
 *
 * Every state carries a shape as well as a colour — a filled circle with a
 * check, an outlined circle with a number, a gold ring with a star. The design
 * system is explicit that no stamp state may depend on colour alone, and a
 * landing page is where colour-blind readers meet the product first.
 */
export function StampPreview({
  earned = 7,
  total = 10,
}: {
  earned?: number;
  total?: number;
}) {
  const slots = Array.from({ length: total }, (_, index) => index + 1);
  const remaining = total - earned;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-5 gap-2.5">
        {slots.map((slot) => {
          const done = slot <= earned;
          const isReward = slot === total;

          return (
            <li
              key={slot}
              className={cn(
                "flex aspect-square items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                !done &&
                  isReward &&
                  "border-reward bg-reward-surface text-foreground",
                !done &&
                  !isReward &&
                  "border-dashed border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check aria-hidden="true" className="size-4" />
              ) : isReward ? (
                <Star aria-hidden="true" className="size-4" />
              ) : (
                slot
              )}
            </li>
          );
        })}
      </ul>

      {/* The sentence is not decoration: "faltam 3" is the thing the customer
          actually reads, and the grid above is the illustration of it. */}
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {earned} de {total} carimbos
        </span>
        {remaining > 0
          ? ` — faltam ${remaining} para ganhar um café.`
          : " — recompensa liberada!"}
      </p>
    </div>
  );
}

export default StampPreview;
