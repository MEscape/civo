import type { ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { createRoleSet } from '../../domain/models/role-set';

import type { Actor } from '../../domain/models/actor';
import type { MembershipWriteOptions } from '../../domain/ports/membership.repository';

/** Empty baselines mean absent membership; nonempty baselines use the same role validation as new roles. */
export function membershipWriteOptions(
  actor: Actor,
  expectedRoles?: readonly string[],
): AppResult<MembershipWriteOptions, ValidationAppError> {
  if (expectedRoles === undefined) {
    return ok({ actor });
  }
  return (expectedRoles.length === 0 ? ok([]) : createRoleSet(expectedRoles)).map((roles) => ({
    actor,
    expectedRoles: roles,
  }));
}
