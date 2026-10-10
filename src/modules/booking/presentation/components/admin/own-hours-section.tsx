import { CheckboxField } from '@components/shared/checkbox-field';

import { AvailabilityEditor } from '../availability/availability-editor';

import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';

export interface OwnHoursSectionProps {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly isEnabled: boolean;
  readonly plan: AvailabilityPlanForm;
  readonly disabled: boolean;
  readonly onEnabledChange: (next: boolean) => void;
  readonly onPlanChange: (next: AvailabilityPlanForm) => void;
}

/** "Has its own hours": off follows the location's opening hours, on shows the editor. */
export function OwnHoursSection({
  id,
  label,
  hint,
  isEnabled,
  plan,
  disabled,
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
      {isEnabled && <AvailabilityEditor value={plan} onChange={onPlanChange} disabled={disabled} />}
    </>
  );
}
