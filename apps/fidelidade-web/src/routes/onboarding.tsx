import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
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
import useCreateStore from "@/hooks/mutations/store/use-create-store";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { slugify } from "@/lib/slug";
import { toast } from "@/lib/toast";
import { useActiveStore } from "@/stores/active-store";

const onboardingSchema = z.object({
  name: z
    .string()
    .min(1, copy.onboarding.nameRequired)
    .min(2, copy.onboarding.nameTooShort),
  slug: z
    .string()
    .min(1, copy.onboarding.slugInvalid)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, copy.onboarding.slugInvalid),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

/**
 * Authenticated, but intentionally NOT under `_app` — `_app` redirects here when
 * the lojista has no store, so nesting it would loop.
 */
export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/auth/entrar",
        search: { redirect: location.pathname },
      });
    }
  },
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const navigate = useNavigate();
  const createStore = useCreateStore();
  const { setStoreId } = useActiveStore();

  const form = useForm<OnboardingValues>({
    resolver: standardSchemaResolver(onboardingSchema),
    defaultValues: { name: "", slug: "" },
  });

  const name = form.watch("name");
  const slug = form.watch("slug");
  const slugDirty = form.getFieldState("slug").isDirty;

  // Suggest the slug from the name until the lojista edits it themselves.
  useEffect(() => {
    if (!slugDirty) {
      form.setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, slugDirty, form]);

  const onSubmit = async (values: OnboardingValues) => {
    try {
      const created = await createStore.mutateAsync({
        name: values.name,
        slug: values.slug,
      });
      setStoreId(created.id);
      toast.success(copy.onboarding.success(created.name));
      void navigate({ to: "/painel" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.onboarding.error,
      );
    }
  };

  const isSubmitting = createStore.isPending;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.onboarding.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.onboarding.subtitle}
        </p>
      </div>

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
                <FormLabel>{copy.onboarding.nameLabel}</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    placeholder={copy.onboarding.namePlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.onboarding.slugLabel}</FormLabel>
                <FormControl>
                  <Input inputMode="url" autoCapitalize="none" {...field} />
                </FormControl>
                <FormDescription>
                  {copy.onboarding.slugHint(slug)}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting ? copy.onboarding.submitting : copy.onboarding.submit}
          </Button>
        </form>
      </Form>
    </main>
  );
}

export default OnboardingRoute;
