import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";
import { maskPhone, onlyDigits } from "@/lib/phone";

type PhoneInputProps = {
  value: string;
  onChange: (digits: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
};

/** A complete BR number is 10 (landline) or 11 (mobile) digits. */
export function isPhoneComplete(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

/**
 * The most-repeated gesture in the product: a cashier types a phone number on a
 * phone keypad while a customer waits.
 *
 * `inputMode="numeric"` so the numeric keypad opens, the value is stored as raw
 * digits and only masked for display, and Enter submits so the flow never needs
 * a second tap. Validity is only ever *suggested* here — the server decides.
 */
export function PhoneInput({
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  id = "customer-phone",
}: PhoneInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{copy.phone.label}</Label>
      <Input
        id={id}
        size="lg"
        inputMode="numeric"
        autoComplete="tel"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={copy.phone.placeholder}
        value={maskPhone(value)}
        onChange={(event) => onChange(onlyDigits(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="[&_[data-slot=input]]:text-xl [&_[data-slot=input]]:tabular-nums"
      />
    </div>
  );
}

export default PhoneInput;
