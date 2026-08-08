import type { PropsWithChildren } from "react";
import { copy } from "@/lib/copy";

type AuthCardProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

/** Shared chrome for /auth/entrar and /auth/cadastrar. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">
          {copy.app.name}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </main>
  );
}

export default AuthCard;
