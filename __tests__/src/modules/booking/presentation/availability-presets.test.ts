import { describe, expect, it } from 'vitest';

import {
  AVAILABILITY_PRESETS,
  AVAILABILITY_PRESET_KEYS,
  EMPTY_PLAN,
  isEmptyPlan,
  withPreset,
} from '@modules/booking/presentation/drafts/availability-plan-form';

describe('availability presets', () => {
  it.each(AVAILABILITY_PRESET_KEYS)('%s describes a full week, Monday first', (key) => {
    expect(AVAILABILITY_PRESETS[key]).toHaveLength(7);
  });

  it('replaces the weekly pattern but keeps closures and absences', () => {
    const plan = {
      ...EMPTY_PLAN,
      exceptions: [{ kind: 'closed', from: '2027-12-24', to: '2027-12-26', label: 'Holidays' }],
    };

    const next = withPreset(plan, 'mornings');

    expect(next.weekly[0]?.intervals).toEqual([{ start: '08:00', end: '12:00' }]);
    expect(next.weekly[6]?.intervals).toEqual([]);
    expect(next.exceptions).toEqual(plan.exceptions);
  });

  it('knows a plan without any hours, so a new resource can start from a sensible week', () => {
    expect(isEmptyPlan(EMPTY_PLAN)).toBe(true);
    expect(isEmptyPlan(withPreset(EMPTY_PLAN, 'office'))).toBe(false);
  });
});
