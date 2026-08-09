import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

/**
 * Codes are `P` or `C` plus 6 characters from the unambiguous alphabet, so the
 * field is 7 slots wide.
 *
 * The pattern accepts only that alphabet, which means a cashier who reads an
 * `O` off a customer's screen and types the letter simply cannot enter it —
 * there is no `O` in a real code, so rejecting the keystroke is more helpful
 * than accepting it and failing the lookup.
 */
export const CODE_LENGTH = 7;

/** Prefixes plus the 30-character body alphabet, both cases accepted. */
const CODE_PATTERN =
  "^[PCpc]?[23456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz]*$";

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  id = "redeem-code",
}: CodeInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{copy.validate.inputLabel}</Label>
      <InputOTP
        id={id}
        maxLength={CODE_LENGTH}
        pattern={CODE_PATTERN}
        value={value}
        disabled={disabled}
        // Codes are printed and spoken in uppercase; accepting lowercase and
        // normalizing is kinder than rejecting it.
        onChange={(next) => onChange(next.toUpperCase())}
        onComplete={(next) => onComplete?.(next.toUpperCase())}
        inputMode="text"
        autoFocus
      >
        <InputOTPGroup>
          {Array.from({ length: CODE_LENGTH }, (_, index) => index).map(
            (slot) => (
              <InputOTPSlot
                key={`code-slot-${slot}`}
                index={slot}
                className="size-11 text-lg font-semibold"
              />
            ),
          )}
        </InputOTPGroup>
      </InputOTP>
      <p className="text-xs text-muted-foreground">{copy.validate.hint}</p>
    </div>
  );
}

export default CodeInput;
