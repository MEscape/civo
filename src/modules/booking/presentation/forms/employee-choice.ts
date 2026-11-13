import type { EmployeeNeed } from '../../application/contracts/booking-constraints';

/**
 * Who serves the service, as one choice in one select: nobody (a reservation of a room or a pitch),
 * anyone, or someone who holds a qualification. The service stores two fields for it; this is only how
 * the select reads and writes them.
 */
const QUALIFIED_PREFIX = 'q:';

export const NO_EMPLOYEE = 'none';
export const ANY_EMPLOYEE = 'any';

export function choiceOf(values: {
  readonly employee: string;
  readonly qualification: string;
}): string {
  if (values.employee === 'qualified') {
    return `${QUALIFIED_PREFIX}${values.qualification}`;
  }
  return values.employee === 'none' ? NO_EMPLOYEE : ANY_EMPLOYEE;
}

export function fieldsOf(choice: string): {
  readonly employee: EmployeeNeed;
  readonly qualification: string;
} {
  if (choice.startsWith(QUALIFIED_PREFIX)) {
    return { employee: 'qualified', qualification: choice.slice(QUALIFIED_PREFIX.length) };
  }
  return { employee: choice === NO_EMPLOYEE ? 'none' : 'any', qualification: '' };
}

/** The choice for a qualification. */
export const qualifiedChoice = (skill: string) => `${QUALIFIED_PREFIX}${skill}`;
