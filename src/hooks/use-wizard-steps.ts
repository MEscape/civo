'use client';

import { useEffect } from 'react';

import { usePathname, useRouter } from '@i18n';

import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

interface WizardStepsOptions<Values extends FieldValues, Step extends string> {
  readonly steps: readonly Step[];
  /** The fields each step owns: validated before moving on, and where an error sends the person. */
  readonly fields: Readonly<Record<Step, ReadonlyArray<FieldPath<Values>>>>;
  /** The step on screen, read from the address by the route (`?step=`). */
  readonly step: Step;
  readonly form: UseFormReturn<Values>;
}

/**
 * Navigation of a `Wizard` over one react-hook-form form. The step lives in the address, so Back
 * works and a reload keeps the place; the form stays mounted across steps. Next validates only the
 * step's own fields; an error (from the client or the server) sends the person to the first step
 * that holds one and focuses that field once the step has rendered.
 */
export function useWizardSteps<Values extends FieldValues, Step extends string>({
  steps,
  fields,
  step,
  form,
}: WizardStepsOptions<Values, Step>) {
  const router = useRouter();
  const pathname = usePathname();
  const index = steps.indexOf(step);
  const previous = steps[index - 1];
  const next = steps[index + 1];
  const goTo = (target: Step) => {
    router.push(`${pathname}?step=${target}`);
  };

  const stepFields = fields[step];
  useEffect(() => {
    const invalid = stepFields.find((field) => form.getFieldState(field).error !== undefined);
    if (invalid === undefined) {
      return undefined;
    }
    let isActive = true;
    // After the wizard has moved focus to the new step's heading.
    queueMicrotask(() => {
      if (isActive) {
        form.setFocus(invalid);
      }
    });
    return () => {
      isActive = false;
    };
  }, [stepFields, form]);

  return {
    step,
    previous,
    next,
    isLast: next === undefined,
    goTo,
    goBack: () => {
      if (previous !== undefined) {
        goTo(previous);
      }
    },
    goNext: async () => {
      if ((await form.trigger([...stepFields], { shouldFocus: true })) && next !== undefined) {
        goTo(next);
      }
    },
    /** Moves to the first step owning one of these invalid fields (names as react-hook-form reports them). */
    showErrors: (invalid: readonly string[]) => {
      const target = steps.find((candidate) =>
        fields[candidate].some((field) =>
          invalid.some(
            (name) =>
              name === field ||
              name.startsWith(`${field}.`) ||
              (field.startsWith(`${name}.`) && form.getFieldState(field).invalid),
          ),
        ),
      );
      if (target !== undefined && target !== step) {
        goTo(target);
      }
    },
  };
}
