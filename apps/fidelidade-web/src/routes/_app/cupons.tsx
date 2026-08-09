import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Ticket } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { SharePanel } from "@/components/coupon/share-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import useCreateCoupon from "@/hooks/mutations/coupon/use-create-coupon";
import useListCoupons from "@/hooks/queries/coupon/use-list-coupons";
import { isPlanLimitError } from "@/lib/api-error";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/cupons")({
  component: CuponsRoute,
});

const couponSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  discountType: z.enum(["percent", "amount", "freebie"]),
  discountValue: z.string().optional(),
  endsAt: z.string().optional(),
  maxRedemptions: z.string().optional(),
});

type CouponValues = z.infer<typeof couponSchema>;

/** "" -> undefined; otherwise a number. Empty means "no limit", not zero. */
function optionalNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function CuponsRoute() {
  const { storeId } = useActiveStore();
  const { data: coupons, isPending, error } = useListCoupons(storeId);
  const createCoupon = useCreateCoupon();
  const [creating, setCreating] = useState(false);

  const form = useForm<CouponValues>({
    resolver: standardSchemaResolver(couponSchema),
    defaultValues: {
      title: "",
      description: "",
      discountType: "percent",
      discountValue: "15",
      endsAt: "",
      maxRedemptions: "",
    },
  });

  const discountType = form.watch("discountType");

  const onSubmit = async (values: CouponValues) => {
    if (!storeId) return;

    const rawValue = optionalNumber(values.discountValue);

    try {
      await createCoupon.mutateAsync({
        storeId,
        title: values.title,
        description: values.description?.trim() || undefined,
        discountType: values.discountType,
        // A freebie has no numeric value; percent is whole points and amount is
        // typed in reais but stored in centavos.
        discountValue:
          values.discountType === "freebie"
            ? undefined
            : values.discountType === "amount" && rawValue !== undefined
              ? Math.round(rawValue * 100)
              : rawValue,
        endsAt: values.endsAt
          ? new Date(values.endsAt).toISOString()
          : undefined,
        maxRedemptions: optionalNumber(values.maxRedemptions),
      });
      toast.success(copy.coupon.created);
      form.reset();
      setCreating(false);
    } catch (err) {
      if (isPlanLimitError(err)) {
        toast.error(err.message);
        return;
      }
      toast.error(err instanceof Error ? err.message : copy.coupon.error);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Spinner className="size-4" />
        <span className="text-sm">{copy.common.loading}</span>
      </div>
    );
  }

  const list = coupons ?? [];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.coupon.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.coupon.subtitle}</p>
      </header>

      {error ? (
        <Alert variant="error">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {!creating ? (
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" className="size-5" />
          {copy.coupon.create}
        </Button>
      ) : (
        <Card>
          <CardContent className="py-5">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.coupon.titleLabel}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={copy.coupon.titlePlaceholder}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.coupon.typeLabel}</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        >
                          <option value="percent">
                            {copy.coupon.typePercent}
                          </option>
                          <option value="amount">
                            {copy.coupon.typeAmount}
                          </option>
                          <option value="freebie">
                            {copy.coupon.typeFreebie}
                          </option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {discountType !== "freebie" ? (
                  <FormField
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{copy.coupon.valueLabel}</FormLabel>
                        <FormControl>
                          <Input type="number" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormDescription>
                          {discountType === "percent"
                            ? copy.coupon.percentHint
                            : copy.coupon.amountHint}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <FormField
                  control={form.control}
                  name="endsAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.coupon.endsAtLabel}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxRedemptions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{copy.coupon.maxLabel}</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" {...field} />
                      </FormControl>
                      <FormDescription>{copy.coupon.maxHint}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCreating(false)}
                  >
                    {copy.common.cancel}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    loading={createCoupon.isPending}
                  >
                    {createCoupon.isPending
                      ? copy.coupon.creating
                      : copy.coupon.create}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Ticket
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="text-sm font-medium">{copy.coupon.empty}</p>
            <p className="text-sm text-muted-foreground">
              {copy.coupon.emptyHint}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((coupon) => {
            const soldOut =
              coupon.maxRedemptions !== null &&
              coupon.redemptionCount >= coupon.maxRedemptions;

            return (
              <li key={coupon.id} className="flex flex-col gap-3">
                <Card>
                  <CardContent className="flex flex-col gap-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <p className="truncate font-medium">{coupon.title}</p>
                        {coupon.endsAt ? (
                          <p className="text-xs text-muted-foreground">
                            {copy.card.expiresAt(formatDate(coupon.endsAt))}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={soldOut ? "secondary" : "default"}>
                        {coupon.discountLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {copy.coupon.redemptionsCount(
                        coupon.redemptionCount,
                        coupon.maxRedemptions,
                      )}
                      {soldOut ? ` · ${copy.coupon.soldOut}` : ""}
                    </p>
                  </CardContent>
                </Card>

                <SharePanel token={coupon.publicToken} title={coupon.title} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CuponsRoute;
