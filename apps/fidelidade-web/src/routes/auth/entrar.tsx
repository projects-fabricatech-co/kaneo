import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { toast } from "@/lib/toast";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

const signInSchema = z.object({
  email: z.email(copy.auth.signUp.invalidEmail),
  password: z.string().min(1, copy.auth.signIn.error),
});

type SignInValues = z.infer<typeof signInSchema>;

export const Route = createFileRoute("/auth/entrar")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/painel" });
    }
  },
  component: SignInRoute,
});

function SignInRoute() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignInValues>({
    resolver: standardSchemaResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInValues) => {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(error.message || copy.auth.signIn.error);
      return;
    }

    toast.success(copy.auth.signIn.success);
    void navigate({ to: redirectTo ?? "/painel" });
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${redirectTo ?? "/painel"}`,
      });
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.auth.googleError,
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <AuthCard
      title={copy.auth.signIn.title}
      subtitle={copy.auth.signIn.subtitle}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.auth.emailLabel}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={copy.auth.emailPlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{copy.auth.passwordLabel}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder={copy.auth.passwordPlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting
              ? copy.auth.signIn.submitting
              : copy.auth.signIn.submit}
          </Button>
        </form>
      </Form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase text-muted-foreground">
          {copy.auth.or}
        </span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        loading={isGoogleLoading}
      >
        {isGoogleLoading ? copy.auth.connecting : copy.auth.continueWithGoogle}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {copy.auth.signIn.toggleMessage}{" "}
        <Link
          to="/auth/cadastrar"
          className="font-medium text-foreground underline"
        >
          {copy.auth.signIn.toggleLink}
        </Link>
      </p>
    </AuthCard>
  );
}

export default SignInRoute;
