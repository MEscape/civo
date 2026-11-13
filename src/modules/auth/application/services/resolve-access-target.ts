import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  accessConflict,
  lastAdmin,
  tenantInvalid,
  userNotFound,
} from '../../domain/errors/auth-errors';
import { parseActorId } from '../../domain/models/ids';

import { findAccount } from './find-account';
import { hasPlatformAuthority, resolveTenantReach } from './load-authorized-user-management';
import { membershipWriteOptions } from './membership-write-options';

import type { Actor } from '../../domain/models/actor';
import type { ActorId } from '../../domain/models/ids';
import type { MembershipWriteOptions } from '../../domain/ports/membership.repository';
import type { PlatformAccessDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { AuthorizedScope } from './load-authorized-user-management';

/** Why a person's access to a website cannot be changed from outside it. */
export type AccessTargetError =
  | AuthorizationError
  | InfrastructureAppError
  | NotFoundAppError
  | ValidationAppError
  | ConflictAppError;

/** A validated access change, ready for the membership store. `options` carries the locked-write checks. */
export interface AccessChange {
  readonly subject: ActorId;
  readonly options: MembershipWriteOptions;
}

/**
 * Everything an access change checks before it writes, in the website the caller was already
 * authorized in: the expected-roles baseline, the target, and that nobody but the platform's
 * administrator changes their own access.
 */
export function resolveAccessChange(
  deps: PlatformAccessDependencies,
  { actor, tenantId }: AuthorizedScope,
  input: { readonly userId: string; readonly expectedRoles?: readonly string[] | undefined },
): AppResultAsync<AccessChange, AccessTargetError> {
  const writeOptions = membershipWriteOptions(actor, input.expectedRoles);
  if (writeOptions.isErr()) {
    return errAsync(writeOptions.error);
  }
  return resolveAccessTarget(deps, { actor, tenantId }, input.userId).andThen(
    ({ subject, email }): AppResultAsync<AccessChange, AccessTargetError> => {
      if (actor.id === subject && !hasPlatformAuthority(actor)) {
        return errAsync(lastAdmin());
      }
      return okAsync({ subject, options: { ...writeOptions.value, subjectEmail: email } });
    },
  );
}

/**
 * Why the membership store refused a write: without a baseline it can only be the website's last
 * administrator; with one, the access changed since the caller looked.
 */
export function accessWriteRefused(expectedRoles: readonly string[] | undefined): ConflictAppError {
  return expectedRoles === undefined ? lastAdmin() : accessConflict();
}

/**
 * Who may be changed: the subject exists and the website exists. The actor may be the subject: a
 * platform administrator's own access is theirs to manage (they are one by the platform, not by a
 * website), and the last administrator of a website is kept by the write itself.
 * Anyone else may only touch people who already belong to a website they
 * manage; every other account answers like a missing one, so neither consent
 * nor account existence can be probed by id.
 */
function resolveAccessTarget(
  deps: PlatformAccessDependencies,
  { actor, tenantId }: AuthorizedScope,
  rawUserId: string,
): AppResultAsync<{ readonly subject: ActorId; readonly email: string }, AccessTargetError> {
  const parsed = parseActorId(rawUserId);
  if (parsed.isErr()) {
    return errAsync(userNotFound());
  }
  const subject = parsed.value;
  return deps.tenants.exists(tenantId).andThen((isWebsite) => {
    if (!isWebsite) {
      return errAsync(tenantInvalid());
    }
    return findAccount(deps.directory, subject).andThen((account) => {
      if (account === null) {
        return errAsync(userNotFound());
      }
      return isVisibleTo(deps, actor, subject).andThen((isVisible) =>
        isVisible ? okAsync({ subject, email: account.email }) : errAsync(userNotFound()),
      );
    });
  });
}

/** Platform authority sees everyone; a manager only people who belong to a website they manage. */
function isVisibleTo(
  deps: PlatformAccessDependencies,
  actor: Actor,
  subject: ActorId,
): AppResultAsync<boolean, AccessTargetError> {
  if (hasPlatformAuthority(actor)) {
    return okAsync(true);
  }
  return resolveTenantReach(deps, actor, 'user.manage').andThen(({ tenantIds }) =>
    deps.members
      .listMembershipsOf([subject], tenantIds ?? undefined)
      .map((found) => (found.get(subject) ?? []).length > 0),
  );
}
