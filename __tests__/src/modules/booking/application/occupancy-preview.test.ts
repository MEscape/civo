import { describe, expect, it } from 'vitest';

import { previewOccupancy } from '@modules/booking/application/contracts/occupancy-preview-model';

const COUNTER = { id: 'counter', name: 'Schalter', setupMinutes: 0, teardownMinutes: 0 };
const BASE = {
  durationMinutes: 20,
  preparationMinutes: 5,
  cleanupMinutes: 10,
  needsEmployee: true,
  resources: [COUNTER],
};

describe('the occupancy preview', () => {
  it('holds the citizen for the appointment, the employee for preparation and clean-up too', () => {
    const preview = previewOccupancy(BASE);

    expect(preview?.citizen).toEqual({ fromMinute: 0, toMinute: 20 });
    expect(preview?.employee).toEqual({ fromMinute: -5, toMinute: 30 });
  });

  it('holds a resource for the appointment plus its own setup and teardown', () => {
    const preview = previewOccupancy({
      ...BASE,
      resources: [{ ...COUNTER, setupMinutes: 15, teardownMinutes: 5 }],
    });

    expect(preview?.resources).toEqual([
      { id: 'counter', name: 'Schalter', span: { fromMinute: -15, toMinute: 25 } },
    ]);
  });

  it('shows no employee row for a service that asks for none', () => {
    expect(previewOccupancy({ ...BASE, needsEmployee: false })?.employee).toBeNull();
  });

  it('shows nothing while the numbers are ones the engine refuses', () => {
    expect(previewOccupancy({ ...BASE, durationMinutes: 0 })).toBeNull();
    expect(previewOccupancy({ ...BASE, resources: [{ ...COUNTER, setupMinutes: -1 }] })).toBeNull();
  });
});
