import { useMutation, useQueryClient } from "@tanstack/react-query";
import createStore, {
  type CreateStoreRequest,
} from "@/fetchers/store/create-store";
import { listStoresQueryKey } from "@/hooks/queries/store/use-list-stores";

function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStoreRequest) => createStore(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listStoresQueryKey });
    },
  });
}

export default useCreateStore;
