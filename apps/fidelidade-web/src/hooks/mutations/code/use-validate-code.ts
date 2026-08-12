import { useMutation } from "@tanstack/react-query";
import validateCode, {
  type ValidateCodeRequest,
} from "@/fetchers/code/validate-code";

function useValidateCode() {
  return useMutation({
    mutationFn: (input: ValidateCodeRequest) => validateCode(input),
  });
}

export default useValidateCode;
