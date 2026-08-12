import { useMutation, useQueryClient } from "@tanstack/react-query";
import createProgram, {
  type CreateProgramRequest,
} from "@/fetchers/program/create-program";
import { programsQueryKey } from "@/hooks/queries/program/use-list-programs";

function useCreateProgram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProgramRequest) => createProgram(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: programsQueryKey(variables.storeId),
      });
    },
  });
}

export default useCreateProgram;
