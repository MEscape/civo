import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { lastAdmin, tenantInvalid, userNotFound } from '../../domain/errors/auth-errors';
import { parseActorId, toTenantId } from '../../domain/models/ids';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { PlatformAccessDependencies } from '../auth-dependencies';

/** Why a person's access to a website cannot be changed from outside it. */
export type AccessTargetError =
  InfrastructureAppError | NotFoundAppError | ValidationAppError | ConflictAppError;

/** Who may be changed, in which website: the subject exists, the website exists, and it is not the actor. */
export function resolveAccessTarget(
  deps: PlatformAccessDependencies,
  actorId: ActorId,
  input: { readonly userId: string; readonly tenantId: string },
): AppResultAsync<{ readonly subject: ActorId; readonly tenantId: TenantId }, AccessTargetError> {
  const parsed = parseActorId(input.userId);
  if (parsed.isErr()) {
    return errAsync(userNotFound());
  }
  const subject = parsed.value;
  if (subject === actorId) {
    return errAsync(lastAdmin());
  }
  const tenantId = toTenantId(input.tenantId);
  return deps.tenants.exists(tenantId).andThen((isWebsite) => {
    if (!isWebsite) {
      return errAsync(tenantInvalid());
    }
    return deps.directory
      .search({
        ids: [subject],
        text: null,
        sort: { field: 'name', direction: 'asc' },
        page: { page: 1, pageSize: 1 },
      })
      .andThen((found) =>
        found.items.length === 0 ? errAsync(userNotFound()) : okAsync({ subject, tenantId }),
      );
  });
}
