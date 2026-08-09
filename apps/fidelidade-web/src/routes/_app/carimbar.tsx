import { createFileRoute, Link } from "@tanstack/react-router";
import { Stamp } from "lucide-react";
import { useState } from "react";
import { StampGrid } from "@/components/card/stamp-grid";
import { isPhoneComplete, PhoneInput } from "@/components/stamp/phone-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import useFindOrCreateCustomer from "@/hooks/mutations/customer/use-find-or-create-customer";
import useCreateStamp from "@/hooks/mutations/stamp/use-create-stamp";
import useListPrograms from "@/hooks/queries/program/use-list-programs";
import { isPlanLimitError } from "@/lib/api-error";
import { copy } from "@/lib/copy";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/carimbar")({
  component: CarimbarRoute,
});

type LastResult = {
  stampsCount: number;
  stampsRequired: number;
  completed: boolean;
};

function CarimbarRoute() {
  const { storeId } = useActiveStore();
  const { data: programs, isPending: loadingPrograms } =
    useListPrograms(storeId);
  const findOrCreate = useFindOrCreateCustomer();
  const stamp = useCreateStamp();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [last, setLast] = useState<LastResult | null>(null);

  const activeProgram = programs?.find(
    (program) => program.status === "active",
  );
  const ready =
    isPhoneComplete(phone) && Boolean(activeProgram) && Boolean(storeId);
  const busy = findOrCreate.isPending || stamp.isPending;

  const handleStamp = async () => {
    if (!ready || !activeProgram || !storeId) {
      if (!isPhoneComplete(phone)) {
        toast.error(copy.phone.incomplete);
      }
      return;
    }

    // One key PER TAP. Generating it anywhere more stable — a useMemo, a ref —
    // would make two genuine consecutive purchases collapse into one stamp.
    const idempotencyKey = crypto.randomUUID();

    try {
      const { customer, created } = await findOrCreate.mutateAsync({
        storeId,
        phone,
        name: name.trim() || null,
      });

      if (created) {
        toast.info(copy.stamp.newCustomer);
      }

      const result = await stamp.mutateAsync({
        storeId,
        programId: activeProgram.id,
        customerId: customer.id,
        idempotencyKey,
        source: "manual",
      });

      const card = result.card;
      setLast({
        stampsCount: card.stampsCount,
        stampsRequired: card.stampsRequired,
        completed: card.status === "completed",
      });

      if (result.replayed) {
        toast.info(copy.stamp.replayed);
      } else if (card.status === "completed") {
        toast.success(copy.stamp.completed);
      } else {
        toast.success(
          copy.stamp.success(card.stampsCount, card.stampsRequired),
        );
      }

      setPhone("");
      setName("");
    } catch (error) {
      if (isPlanLimitError(error)) {
        toast.error(error.message, {
          action: { label: copy.plan.upgrade, onClick: () => {} },
        });
        return;
      }
      toast.error(error instanceof Error ? error.message : copy.stamp.error);
    }
  };

  if (loadingPrograms) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">{copy.common.loading}</span>
      </div>
    );
  }

  if (!activeProgram) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {copy.stamp.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.stamp.noProgram}</p>
        <Button render={<Link to="/programa" />}>
          {copy.stamp.createProgram}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.stamp.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.stamp.subtitle}</p>
      </header>

      <PhoneInput
        value={phone}
        onChange={setPhone}
        onSubmit={handleStamp}
        disabled={busy}
        autoFocus
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-name">{copy.stamp.nameOptional}</Label>
        <Input
          id="customer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={copy.stamp.namePlaceholder}
          disabled={busy}
          autoComplete="off"
        />
      </div>

      {/* Deliberately large: this is tapped one-handed, at a counter, in a hurry. */}
      <Button
        size="xl"
        className="h-16 w-full text-lg"
        onClick={handleStamp}
        disabled={!ready}
        loading={busy}
      >
        <Stamp aria-hidden="true" className="size-6" />
        {busy ? copy.stamp.stamping : copy.stamp.action}
      </Button>

      {last ? (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <p className="text-sm font-medium">
              {copy.card.stampsOf(last.stampsCount, last.stampsRequired)}
            </p>
            <StampGrid
              count={last.stampsCount}
              goal={last.stampsRequired}
              justStampedIndex={last.stampsCount - 1}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default CarimbarRoute;
