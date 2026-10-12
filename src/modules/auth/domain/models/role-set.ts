import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { AUTH_VALIDATION_CODES, createAuthErrorBag } from '../errors/auth-errors';

import { ROLES, isRole } from './role';

import type { Role } from './role';

/**
 * A non-empty set of known roles, without duplicates, in the canonical
 * order of `ROLES`. A member always holds at least one role: removing the
 * last one is removing the member, which is a separate, explicit action.
 */
export function createRoleSet(
  raw: readonly string[],
): AppResult<readonly Role[], ValidationAppError> {
  const bag = createAuthErrorBag();
  if (raw.length === 0) {
    bag.add('roles', AUTH_VALIDATION_CODES.rolesRequired);
  }
  if (!raw.every(isRole)) {
    bag.add('roles', AUTH_VALIDATION_CODES.roleInvalid);
  }
  if (bag.hasErrors) {
    return err(bag.toError());
  }
  return ok(ROLES.filter((role) => raw.includes(role)));
}
