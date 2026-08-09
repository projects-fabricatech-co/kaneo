import { useMutation, useQueryClient } from "@tanstack/react-query";
import createStamp, {
  type CreateStampRequest,
} from "@/fetchers/stamp/create-stamp";

function useCreateStamp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStampRequest) => createStamp(input),
    onSuccess: () => {
      // The customer may have this card open on their own phone right now.
      queryClient.invalidateQueries({ queryKey: ["public-card"] });
    },
  });
}

export default useCreateStamp;
