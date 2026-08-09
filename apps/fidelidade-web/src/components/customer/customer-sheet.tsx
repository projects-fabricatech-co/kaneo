import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Customer } from "@/fetchers/customer/list-customers";
import useCustomerHistory from "@/hooks/queries/customer/use-customer-history";
import { copy } from "@/lib/copy";
import { formatDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { CustomerHistoryView } from "./customer-history";

/**
 * The history is fetched only once a customer is open, keyed by id, so browsing
 * a list of 200 people costs one request rather than 200.
 *
 * `customer` doubles as the open state: passing null closes the sheet, which
 * keeps the caller from having to keep an id and a boolean in sync.
 */
export function CustomerSheet({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const { data, error, isPending } = useCustomerHistory(customer?.id ?? null);

  return (
    <Sheet
      open={Boolean(customer)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup side="bottom" className="max-h-[85svh] sm:max-h-[90svh]">
        <SheetHeader>
          <SheetTitle>
            {customer?.name?.trim() || copy.customers.noName}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {customer ? formatPhone(customer.phone) : ""}
            {customer
              ? ` · ${copy.customers.since(formatDate(customer.createdAt))}`
              : ""}
          </p>
        </SheetHeader>

        <SheetPanel>
          {error ? (
            <Alert variant="error">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : isPending || !data ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : (
            <CustomerHistoryView history={data} />
          )}
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}

export default CustomerSheet;
