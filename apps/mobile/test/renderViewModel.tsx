import { render, fireEvent } from '@testing-library/react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { TextInput } from 'react-native';

// react-hook-form's Controller-driven fields have no public API to set a
// value without a rendered input (control/useController expose no setValue).
// Rendering real Controller-wrapped TextInputs and driving them via
// fireEvent.changeText is the only reliable way to exercise a viewmodel's
// full submit path (validation -> onSubmit) from a Jest unit test.
export async function renderViewModel<VM, TForm extends FieldValues>(
  useViewModel: () => VM,
  getControl: (vm: VM) => Control<TForm>,
  fieldNames: Path<TForm>[],
) {
  let latestVm: VM;

  function Harness() {
    const vm = useViewModel();
    latestVm = vm;
    const control = getControl(vm);
    return (
      <>
        {fieldNames.map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field: { onChange, value } }) => (
              <TextInput testID={`field-${name}`} value={value} onChangeText={onChange} />
            )}
          />
        ))}
      </>
    );
  }

  const utils = await render(<Harness />);

  return {
    ...utils,
    getVm: (): VM => latestVm,
    setFieldValue: (name: Path<TForm>, value: string) =>
      fireEvent.changeText(utils.getByTestId(`field-${name}`), value),
  };
}
