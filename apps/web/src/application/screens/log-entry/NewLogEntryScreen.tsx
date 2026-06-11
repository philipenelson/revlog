"use client";

import { LogEntryFormView } from "./LogEntryFormView";
import { useNewLogEntryViewModel } from "./useNewLogEntryViewModel";

export function NewLogEntryScreen() {
  const vm = useNewLogEntryViewModel();

  return (
    <LogEntryFormView
      vehicleId={vm.vehicleId}
      mode="create"
      state={vm.formState}
      onChange={vm.setFormState}
      onSave={vm.handleSave}
      isSaving={vm.isSaving}
      error={vm.error}
    />
  );
}
