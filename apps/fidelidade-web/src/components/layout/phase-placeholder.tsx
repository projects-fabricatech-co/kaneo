import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { copy } from "@/lib/copy";

type PhasePlaceholderProps = {
  title: string;
  description: string;
};

/**
 * Stand-in for a screen a later phase owns. It exists now so the shell's typed
 * navigation links resolve and the routing can be verified end to end before
 * the real screens land.
 */
export function PhasePlaceholder({
  title,
  description,
}: PhasePlaceholderProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{copy.common.soon}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default PhasePlaceholder;
