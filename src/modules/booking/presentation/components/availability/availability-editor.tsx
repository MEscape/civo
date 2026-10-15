import { useErrorText } from '../../hooks/use-error-text';
import { WeekTimeline } from '../../timeline/week-timeline';
import { NO_ERRORS } from '../shared/form-error-summary';

import { ExceptionsEditor } from './exceptions-editor';

import type { AvailabilityPlanForm } from '../../schemas/availability-plan-schema';
import type { FormErrors } from '../shared/form-error-summary';

export interface AvailabilityEditorProps {
  readonly value: AvailabilityPlanForm;
  readonly onChange: (next: AvailabilityPlanForm) => void;
  /** The hours this plan must stay inside (the location's); `null` when this is the location's own plan. */
  readonly bounds?: AvailabilityPlanForm['weekly'] | null;
  readonly disabled?: boolean;
  /** What the last save found wrong, so the days and exceptions at fault are marked where they are. */
  readonly errors?: FormErrors;
  /** The path of this plan in the saved form (`openingHours`, `availability`), which prefixes its error paths. */
  readonly errorPath?: string;
}

/**
 * Edits one availability plan: the weekly pattern as bars on a timeline, and
 * dated exceptions (closures, one-off changes, extra openings). The same editor
 * serves a location's opening hours, a resource's working time and a service's
 * own restrictions, because they are the same kind of plan; the last two pass
 * the location's week as `bounds`.
 */
export function AvailabilityEditor({
  value,
  onChange,
  bounds = null,
  disabled = false,
  errors = NO_ERRORS,
  errorPath = 'availability',
}: AvailabilityEditorProps) {
  const errorText = useErrorText(errors);

  return (
    <div className="space-y-6">
      <WeekTimeline
        weekly={value.weekly}
        bounds={bounds}
        disabled={disabled}
        problemOn={(dayIndex) =>
          errorText(`${errorPath}.weekly.${dayIndex}.intervals`) ??
          errorText(`${errorPath}.weekly.${dayIndex}.breaks`)
        }
        onChange={(weekly) => {
          onChange({ ...value, weekly });
        }}
      />
      <ExceptionsEditor
        exceptions={value.exceptions}
        weekly={value.weekly}
        disabled={disabled}
        errors={errors}
        errorPath={errorPath}
        onChange={(exceptions) => {
          onChange({ ...value, exceptions });
        }}
      />
    </div>
  );
}
