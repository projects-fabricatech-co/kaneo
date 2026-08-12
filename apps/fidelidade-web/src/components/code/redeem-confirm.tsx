import { Gift, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";

export type ValidatedCode = {
  kind: "reward" | "coupon";
  code: string;
  description: string;
  expiresAt: string | null;
};

type RedeemConfirmProps = {
  validated: ValidatedCode;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

/**
 * The confirmation step between "code is valid" and "redeemed".
 *
 * Redemption is irreversible and gives away something real, so the lojista sees
 * exactly what they are about to hand over before committing. Validating is a
 * read; only this button mutates.
 */
export function RedeemConfirm({
  validated,
  onConfirm,
  onCancel,
  confirming,
}: RedeemConfirmProps) {
  const Icon = validated.kind === "reward" ? Gift : Ticket;
  const kindLabel =
    validated.kind === "reward"
      ? copy.validate.rewardKind
      : copy.validate.couponKind;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {kindLabel}
          </span>
          <p className="text-sm text-muted-foreground">
            {copy.validate.aboutToGive}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p className="text-lg font-semibold">{validated.description}</p>
        </div>

        <p className="font-mono text-sm tracking-[0.2em] text-muted-foreground">
          {validated.code}
        </p>

        <p className="text-xs text-muted-foreground">
          {validated.expiresAt
            ? copy.validate.validUntil(formatDate(validated.expiresAt))
            : copy.validate.noExpiry}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1"
            onClick={onConfirm}
            loading={confirming}
          >
            {confirming ? copy.validate.confirming : copy.validate.confirm}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={confirming}
          >
            {copy.validate.cancel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RedeemConfirm;
