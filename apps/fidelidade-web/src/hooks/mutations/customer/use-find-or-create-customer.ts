import { useMutation } from "@tanstack/react-query";
import findOrCreateCustomer, {
  type FindOrCreateCustomerRequest,
} from "@/fetchers/customer/find-or-create-customer";

function useFindOrCreateCustomer() {
  return useMutation({
    mutationFn: (input: FindOrCreateCustomerRequest) =>
      findOrCreateCustomer(input),
  });
}

export default useFindOrCreateCustomer;
