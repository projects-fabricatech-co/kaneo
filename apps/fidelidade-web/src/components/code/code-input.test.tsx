import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_LENGTH, CodeInput } from "./code-input";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function setup(value = "") {
  const onChange = vi.fn();
  const onComplete = vi.fn();
  render(
    <CodeInput value={value} onChange={onChange} onComplete={onComplete} />,
  );
  return { input: screen.getByLabelText("Código"), onChange, onComplete };
}

describe("CodeInput", () => {
  it("is seven slots wide, matching prefix + six body characters", () => {
    expect(CODE_LENGTH).toBe(7);
  });

  it("uppercases what the cashier types", () => {
    // Codes are printed and read aloud in uppercase; accepting lowercase and
    // normalizing beats rejecting it at the counter.
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "p4kj9m" } });
    expect(onChange).toHaveBeenCalledWith("P4KJ9M");
  });

  it("refuses characters that cannot appear in a real code", () => {
    // There is no O, 0, I, 1, L or U in the code alphabet, so a cashier who
    // misreads one gets the keystroke rejected instead of a failed lookup.
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "POO" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a full valid reward code", () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: "P4KJ9MN" } });
    expect(onChange).toHaveBeenCalledWith("P4KJ9MN");
  });

  it("shows the format hint", () => {
    setup();
    expect(screen.getByText(/7 caracteres/)).toBeInTheDocument();
  });

  it("can be disabled while a redemption is in flight", () => {
    render(<CodeInput value="P4KJ9M" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Código")).toBeDisabled();
  });
});
