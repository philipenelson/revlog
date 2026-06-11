import type { ReactNode } from "react";

export interface FormFieldClasses {
  field: string;
  fieldLabel: string;
  optional: string;
  fieldError: string;
}

export interface FormFieldProps {
  label: string;
  id: string;
  optional?: boolean;
  error?: string;
  classes: FormFieldClasses;
  children: ReactNode;
}

/**
 * Labelled form field with optional marker and inline error, shared by the
 * vehicle forms (add / edit / onboarding). Class names come from the host
 * screen's CSS module so each screen keeps its own sizing.
 */
export function FormField({ label, id, optional, error, classes, children }: FormFieldProps) {
  return (
    <div className={classes.field}>
      <label className={classes.fieldLabel} htmlFor={id}>
        {label}
        {optional && <span className={classes.optional}> (optional)</span>}
      </label>
      {children}
      {error && (
        <span className={classes.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
