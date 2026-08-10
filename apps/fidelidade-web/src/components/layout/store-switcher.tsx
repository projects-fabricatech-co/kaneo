import { Store } from "lucide-react";
import { copy } from "@/lib/copy";

type StoreOption = {
  id: string;
  name: string;
};

type StoreSwitcherProps = {
  stores: StoreOption[];
  activeStoreId: string | null;
  onSelect: (storeId: string) => void;
};

/**
 * Only renders a picker when the lojista actually has more than one store —
 * which on the Grátis and Essencial plans is never, so most users just see the
 * store name.
 */
export function StoreSwitcher({
  stores,
  activeStoreId,
  onSelect,
}: StoreSwitcherProps) {
  const active = stores.find((store) => store.id === activeStoreId);

  if (stores.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Store
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="truncate text-sm font-medium">
          {active?.name ?? copy.shell.noStore}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Store
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <label className="sr-only" htmlFor="store-switcher">
        {copy.shell.switchStore}
      </label>
      <select
        id="store-switcher"
        value={activeStoreId ?? ""}
        onChange={(event) => onSelect(event.target.value)}
        className="min-h-11 min-w-0 truncate rounded-md border border-border bg-card px-2 py-1 text-sm font-medium sm:min-h-8"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default StoreSwitcher;
