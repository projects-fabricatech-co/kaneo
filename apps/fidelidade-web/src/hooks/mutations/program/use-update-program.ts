import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateProgram, {
  type UpdateProgramRequest,
} from "@/fetchers/program/update-program";
import { programsQueryKey } from "@/hooks/queries/program/use-list-programs";

function useUpdateProgram(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProgramRequest & { id: string }) =>
      updateProgram(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programsQueryKey(storeId) });
    },
  });
}

export default useUpdateProgram;
