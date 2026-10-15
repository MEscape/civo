import { CheckboxField } from '@components/shared/checkbox-field';

import { AvailabilityEditor } from '../availability/availability-editor';

import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';
import type { FormErrors } from '../shared/form-error-summary';

export interface OwnHoursSectionProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly isEnabled: boolean;
  readonly plan: AvailabilityPlanForm;
  /** The location's week: what is set here can only be narrower. */
  readonly bounds: AvailabilityPlanForm['weekly'];
  readonly disabled: boolean;
  readonly errors: FormErrors;
  readonly onEnabledChange: (next: boolean) => void;
  readonly onPlanChange: (next: AvailabilityPlanForm) => void;
}

/**
 * "Only at certain times": off means the location's opening hours apply
 * as they are, on shows the week with the location's hours behind it, where
 * bars can be drawn only inside them.
 */
export function OwnHoursSection({
  id,
  label,
  hint,
  isEnabled,
  plan,
  bounds,
  disabled,
  errors,
  onEnabledChange,
  onPlanChange,
}: OwnHoursSectionProps) {
  return (
    <>
      <CheckboxField
        id={id}
        label={label}
        hint={hint}
        checked={isEnabled}
        onChange={(event) => {
          onEnabledChange(event.target.checked);
        }}
      />
      {isEnabled && (
        <AvailabilityEditor
          value={plan}
          bounds={bounds}
          onChange={onPlanChange}
          disabled={disabled}
          errors={errors}
        />
      )}
    </>
  );
}
