import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { CODE_LENGTH, CodeInput } from "@/components/code/code-input";
import {
  RedeemConfirm,
  type ValidatedCode,
} from "@/components/code/redeem-confirm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import useRedeemCode from "@/hooks/mutations/code/use-redeem-code";
import useValidateCode from "@/hooks/mutations/code/use-validate-code";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/validar")({
  component: ValidarRoute,
});

type Stage =
  | { step: "entering" }
  | { step: "confirming"; validated: ValidatedCode }
  | { step: "unusable"; reason: string }
  | { step: "done"; description: string; resetCard: boolean };

function ValidarRoute() {
  const { storeId } = useActiveStore();
  const validate = useValidateCode();
  const redeem = useRedeemCode();

  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "entering" });

  const reset = () => {
    setCode("");
    setStage({ step: "entering" });
  };

  const handleCheck = async (value: string) => {
    if (!storeId || value.length < CODE_LENGTH) return;

    try {
      const result = await validate.mutateAsync({ storeId, code: value });

      // A spent or expired code answers 200 and describes itself; only a
      // nonexistent one throws. Say precisely which it is.
      if (!result.usable) {
        setStage({
          step: "unusable",
          reason:
            result.status === "redeemed"
              ? result.redeemedAt
                ? `${copy.validate.alreadyUsed} (${formatDate(result.redeemedAt)})`
                : copy.validate.alreadyUsed
              : copy.validate.expired,
        });
        return;
      }

      setStage({
        step: "confirming",
        validated: {
          kind: result.kind,
          code: result.code,
          description: result.description,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      setStage({
        step: "unusable",
        reason: error instanceof Error ? error.message : copy.validate.notFound,
      });
    }
  };

  const handleConfirm = async () => {
    if (!storeId || stage.step !== "confirming") return;

    try {
      const result = await redeem.mutateAsync({
        storeId,
        code: stage.validated.code,
      });

      // One field, two kinds. The server discriminates on `kind`, and only a
      // prize resets a stamp card — a coupon has no card behind it.
      setStage({
        step: "done",
        description:
          result.kind === "reward"
            ? result.reward.description
            : result.coupon.discountLabel,
        resetCard: result.kind === "reward",
      });
      setCode("");
      toast.success(copy.validate.redeemed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.validate.error);
      reset();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.validate.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.validate.subtitle}
        </p>
      </header>

      {stage.step === "done" ? (
        <Card className="border-success/40 bg-success/8">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            {/* Success is GREEN, not brand coral. Coral sits close enough to red
                that a confirmation painted in it reads as a refusal at a glance,
                and this is the screen where the cashier decides whether to hand
                over a free coffee. The design system keeps a separate success
                colour for exactly this. */}
            <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
            <p className="text-lg font-semibold">{copy.validate.redeemed}</p>
            <p className="text-sm">{stage.description}</p>
            {stage.resetCard ? (
              <p className="text-sm text-muted-foreground">
                {copy.validate.cardReset}
              </p>
            ) : null}
            <Button variant="outline" onClick={reset} className="mt-1">
              {copy.validate.title}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <CodeInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (stage.step !== "entering") {
                setStage({ step: "entering" });
              }
            }}
            onComplete={handleCheck}
            disabled={validate.isPending || redeem.isPending}
          />

          {stage.step === "entering" ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => handleCheck(code)}
              disabled={code.length < CODE_LENGTH}
              loading={validate.isPending}
            >
              {validate.isPending
                ? copy.validate.checking
                : copy.validate.check}
            </Button>
          ) : null}

          {stage.step === "unusable" ? (
            <Alert variant="error">
              <AlertDescription>{stage.reason}</AlertDescription>
            </Alert>
          ) : null}

          {stage.step === "confirming" ? (
            <RedeemConfirm
              validated={stage.validated}
              onConfirm={handleConfirm}
              onCancel={reset}
              confirming={redeem.isPending}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export default ValidarRoute;
