import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { CustomerSheet } from "@/components/customer/customer-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import useListCustomers from "@/hooks/queries/customer/use-list-customers";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { useActiveStore } from "@/stores/active-store";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesRoute,
});

function ClientesRoute() {
  const { storeId } = useActiveStore();
  const [term, setTerm] = useState("");
  // The counter types on a phone keypad; deferring keeps each keystroke from
  // firing its own request without the timing bugs a manual debounce brings.
  const deferredTerm = useDeferredValue(term.trim());

  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListCustomers(storeId, deferredTerm);

  const customers = data?.pages.flatMap((page) => page.items) ?? [];
  const searching = deferredTerm.length > 0;

  // The id, not the row: a refetch replaces the objects, and holding the old one
  // would freeze the sheet on stale data while the list behind it updated.
  const [openId, setOpenId] = useState<string | null>(null);
  const openCustomer = customers.find((item) => item.id === openId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copy.customers.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copy.customers.subtitle}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-search">{copy.customers.searchLabel}</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="customer-search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={copy.customers.searchPlaceholder}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="error">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              {searching
                ? copy.customers.noResults(deferredTerm)
                : copy.customers.empty}
            </p>
            {searching ? null : (
              <p className="text-sm text-muted-foreground">
                {copy.customers.emptyHint}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Card
                render={
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setOpenId(customer.id)}
                  />
                }
              >
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate font-medium">
                      {customer.name?.trim() || copy.customers.noName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(customer.phone)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(customer.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CustomerSheet customer={openCustomer} onClose={() => setOpenId(null)} />

      {hasNextPage ? (
        <Button
          variant="outline"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
        >
          {isFetchingNextPage
            ? copy.customers.loadingMore
            : copy.customers.loadMore}
        </Button>
      ) : null}
    </div>
  );
}

export default ClientesRoute;
