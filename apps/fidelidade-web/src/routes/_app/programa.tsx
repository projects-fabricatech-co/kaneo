import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { StampGrid } from "@/components/card/stamp-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import useCreateProgram from "@/hooks/mutations/program/use-create-program";
import useUpdateProgram from "@/hooks/mutations/program/use-update-program";
import useListPrograms from "@/hooks/queries/program/use-list-programs";
import { isPlanLimitError } from "@/lib/api-error";
import { copy } from "@/lib/copy";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/programa")({
  component: ProgramaRoute,
});

/**
 * Numeric fields are held as strings, not `z.coerce.number()`.
 *
 * Coercion makes the schema's input type diverge from its output type, and the
 * react-hook-form resolver will not accept that divergence. A number input hands
 * back a string anyway, so keeping the form value a string and converting once
 * at submit is both simpler and closer to what the DOM actually gives us.
 */
const intField = (min: number, max: number) =>
  z.string().refine(
    (value) => {
      const parsed = Number(value);
      return (
        value.trim() !== "" &&
        Number.isInteger(parsed) &&
        parsed >= min &&
        parsed <= max
      );
    },
    { message: `Informe um número inteiro entre ${min} e ${max}.` },
  );

// Mirrors the server's valibot bounds. The server is still the authority; these
// exist so the lojista gets the error before a round trip.
const programSchema = z.object({
  name: z.string().min(2).max(80),
  rewardDescription: z.string().min(2).max(200),
  stampsRequired: intField(1, 100),
  rewardValidityDays: intField(1, 3650),
  cooldownMinutes: intField(0, 1440),
  cardColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

type ProgramValues = z.infer<typeof programSchema>;

const DEFAULTS: ProgramValues = {
  name: "Cartão Fidelidade",
  rewardDescription: "",
  stampsRequired: "10",
  rewardValidityDays: "30",
  cooldownMinutes: "60",
  cardColor: "#D93825",
};

function ProgramaRoute() {
  const { storeId } = useActiveStore();
  const { data: programs, isPending } = useListPrograms(storeId);
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram(storeId ?? "");

  const existing = programs?.find((program) => program.status === "active");

  const form = useForm<ProgramValues>({
    resolver: standardSchemaResolver(programSchema),
    defaultValues: DEFAULTS,
  });

  const { reset } = form;

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        rewardDescription: existing.rewardDescription,
        stampsRequired: String(existing.stampsRequired),
        rewardValidityDays: String(existing.rewardValidityDays),
        cooldownMinutes: String(existing.cooldownMinutes),
        cardColor: existing.cardColor,
      });
    }
  }, [existing, reset]);

  const goal = form.watch("stampsRequired");
  const color = form.watch("cardColor");

  const onSubmit = async (values: ProgramValues) => {
    if (!storeId) return;

    const payload = {
      name: values.name,
      rewardDescription: values.rewardDescription,
      cardColor: values.cardColor,
      stampsRequired: Number(values.stampsRequired),
      rewardValidityDays: Number(values.rewardValidityDays),
      cooldownMinutes: Number(values.cooldownMinutes),
    };

    try {
      if (existing) {
        await updateProgram.mutateAsync({ id: existing.id, ...payload });
        toast.success(copy.program.updated);
      } else {
        await createProgram.mutateAsync({ storeId, ...payload });
        toast.success(copy.program.created);
      }
    } catch (error) {
      if (isPlanLimitError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : copy.program.error);
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

  const saving = createProgram.isPending || updateProgram.isPending;
  const parsedGoal = Number(goal);
  const previewGoal =
    Number.isInteger(parsedGoal) && parsedGoal > 0 ? parsedGoal : 10;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.program.title}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.program.subtitle}</p>
      </header>

      <Card
        style={
          {
            backgroundColor: color,
            color: "#FFFFFF",
            "--stamp-fill": "#FFFFFF",
            "--stamp-on-fill": color,
          } as React.CSSProperties
        }
        className="border-none"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium opacity-80">
            {copy.program.preview}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StampGrid count={Math.min(3, previewGoal)} goal={previewGoal} />
        </CardContent>
      </Card>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.nameLabel}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={copy.program.namePlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rewardDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.rewardLabel}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={copy.program.rewardPlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stampsRequired"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.stampsLabel}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{copy.program.stampsHint}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cooldownMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.cooldownLabel}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1440}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{copy.program.cooldownHint}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rewardValidityDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.validityLabel}</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={1} {...field} />
                </FormControl>
                <FormDescription>{copy.program.validityHint}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cardColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.program.colorLabel}</FormLabel>
                <FormControl>
                  <Input type="color" className="h-11 w-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" loading={saving}>
            {saving
              ? copy.program.saving
              : existing
                ? copy.program.saveSubmit
                : copy.program.createSubmit}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default ProgramaRoute;
