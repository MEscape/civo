import { describe, expect, it } from 'vitest';

import type { ServiceInput } from '@modules/booking/application/contracts/service-inputs';
import { parseServiceInput } from '@modules/booking/application/services/parse-service-input';

const VALID: ServiceInput = {
  name: '  Personalausweis beantragen ',
  description: '',
  category: 'Ausweise',
  documents: ['Pass', ' pass ', ''],
  instructions: '',
  internalNote: '',
  isOnlineBookable: true,
  isActive: true,
  durationMinutes: 20,
  preparationMinutes: 5,
  cleanupMinutes: 10,
  resources: [{ resourceId: 'r1', isRequired: true }],
  noticeMinutes: 1440,
  horizonDays: 90,
  cancelUntilMinutes: 1440,
  changeUntilMinutes: 720,
  actors: ['customer', 'manager'],
  employee: 'qualified',
  qualification: ' ausweise ',
};

const fieldsOf = (overrides: Partial<ServiceInput>) => {
  const result = parseServiceInput({ ...VALID, ...overrides });
  return result.isErr() ? Object.keys(result.error.fieldErrors).sort() : [];
};

describe('reading the service form', () => {
  it('trims, drops blanks and duplicates, and turns empty text into none', () => {
    const { shared, local } = parseServiceInput(VALID)._unsafeUnwrap();

    expect(shared.name).toBe('Personalausweis beantragen');
    expect(shared.description).toBeNull();
    expect(shared.documents).toEqual(['Pass']);
    expect(shared.qualification).toBe('ausweise');
    expect(local.resources).toEqual([{ resourceId: 'r1', isRequired: true }]);
  });

  it('keeps no qualification unless one is asked for', () => {
    const { shared } = parseServiceInput({ ...VALID, employee: 'any' })._unsafeUnwrap();

    expect(shared.qualification).toBeNull();
  });

  it.each([
    ['a blank name', { name: '  ' }, ['name']],
    ['a duration of nothing', { durationMinutes: 0 }, ['durationMinutes']],
    ['a negative deadline', { cancelUntilMinutes: -1 }, ['cancelUntilMinutes']],
    ['a notice as long as the horizon', { noticeMinutes: 90 * 1440 }, ['noticeMinutes']],
    ['a horizon of nothing', { horizonDays: 0 }, ['horizonDays']],
    ['nobody who may cancel', { actors: [] }, ['actors']],
    ['an actor that does not exist', { actors: ['customer', 'robot'] }, ['actors']],
    ['a qualification asked for but not named', { qualification: ' ' }, ['qualification']],
    ['an employee need that does not exist', { employee: 'nobody' as never }, ['employee']],
    [
      'a resource named twice',
      {
        resources: [
          { resourceId: 'r1', isRequired: true },
          { resourceId: 'r1', isRequired: false },
        ],
      },
      ['resources'],
    ],
  ])('refuses %s at its own field', (_name, overrides, expected) => {
    expect(fieldsOf(overrides)).toEqual(expected);
  });

  it('reports every wrong field at once', () => {
    expect(fieldsOf({ name: '', actors: [], horizonDays: 0 })).toEqual([
      'actors',
      'horizonDays',
      'name',
    ]);
  });
});
