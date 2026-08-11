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
  FormDescription,
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

const signUpSchema = z.object({
  name: z.string().min(1, copy.auth.signUp.nameRequired),
  email: z.email(copy.auth.signUp.invalidEmail),
  password: z.string().min(8, copy.auth.signUp.passwordTooShort),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export const Route = createFileRoute("/auth/cadastrar")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/painel" });
    }
  },
  component: SignUpRoute,
});

function SignUpRoute() {
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: standardSchemaResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignUpValues) => {
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error(error.message || copy.auth.signUp.error);
      return;
    }

    toast.success(copy.auth.signUp.success);
    // A brand new account has no store yet; `_app` sends them to /onboarding.
    void navigate({ to: "/painel" });
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/painel`,
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
      title={copy.auth.signUp.title}
      subtitle={copy.auth.signUp.subtitle}
    >
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
                <FormLabel>{copy.auth.nameLabel}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
                    placeholder={copy.auth.namePlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    autoComplete="new-password"
                    placeholder={copy.auth.passwordPlaceholder}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {copy.auth.signUp.passwordHint}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {isSubmitting
              ? copy.auth.signUp.submitting
              : copy.auth.signUp.submit}
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

      {/* Section 1 of the Termos says signing up is the acceptance. That is only
          honest if the texts are one tap away from the button that does it. */}
      <p className="text-center text-xs text-muted-foreground">
        {copy.auth.signUp.legalNotice}{" "}
        <Link to="/termos" className="underline underline-offset-4">
          {copy.legal.terms}
        </Link>{" "}
        {copy.common.and}{" "}
        <Link to="/privacidade" className="underline underline-offset-4">
          {copy.legal.privacy}
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground">
        {copy.auth.signUp.toggleMessage}{" "}
        <Link
          to="/auth/entrar"
          className="font-medium text-foreground underline"
        >
          {copy.auth.signUp.toggleLink}
        </Link>
      </p>
    </AuthCard>
  );
}

export default SignUpRoute;
