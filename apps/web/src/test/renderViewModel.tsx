import { render, fireEvent, act, renderHook, waitFor } from "@testing-library/react";
import type { UseFormRegister, FieldValues, Path } from "react-hook-form";

// Hook-shell test harness (ADR 0043). The pure functional core is unit-tested
// directly (see the co-located *.logic.test.ts); this exercises the coordination
// layer — state transitions, effects, and RHF-bound submit handlers.

// Re-exported so viewmodels with no form (data-fetch, dialogs) can drive their
// hook shell directly with renderHook + act.
export { renderHook, act, waitFor };

// react-hook-form's `register` binds to real, ref'd inputs; there is no public
// API to feed it a value without a rendered field. So to exercise a viewmodel's
// full submit path (RHF validation -> onSubmit) we render the actual registered
// inputs and drive them via fireEvent.change, mirroring the mobile harness.
export function renderViewModelForm<VM, TForm extends FieldValues>(
  useViewModel: () => VM,
  getRegister: (vm: VM) => UseFormRegister<TForm>,
  fieldNames: Path<TForm>[],
) {
  let latestVm: VM;

  function Harness() {
    const vm = useViewModel();
    latestVm = vm;
    const register = getRegister(vm);
    return (
      <>
        {fieldNames.map((name) => (
          <input key={name} data-testid={`field-${name}`} {...register(name)} />
        ))}
      </>
    );
  }

  const utils = render(<Harness />);

  return {
    ...utils,
    getVm: (): VM => latestVm,
    setField: (name: Path<TForm>, value: string) =>
      fireEvent.change(utils.getByTestId(`field-${name}`), { target: { value } }),
  };
}
