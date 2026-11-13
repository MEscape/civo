import { UpdateOwnProfile } from '@modules/auth/application/commands/update-own-profile';
import type { ProfileDependencies } from '@modules/auth/application/profile-dependencies';
import { GetOwnProfile } from '@modules/auth/application/queries/get-own-profile';
import {
  permissionDenied,
  providerFailed,
  unauthenticated,
} from '@modules/auth/domain/errors/auth-errors';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { OwnProfile } from '@modules/auth/domain/ports/profile-account.port';

import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../../support/rate-limiting';

export function profileWorld() {
  const actor = { id: toActorId('own-account'), tenantId: toTenantId('unassigned'), roles: [] };
  let profile: OwnProfile = {
    name: 'Ada',
    email: 'ada@example.org',
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    image: 'https://files.example/profiles/own-account/old-photo',
  };
  const faults = { anonymous: false, account: false, write: false, upload: false, cleanup: false };
  const images = new Set([profile.image]);
  const events: string[] = [];
  const deps: ProfileDependencies = {
    authorization: {
      requireActor: () => (faults.anonymous ? errAsync(unauthenticated()) : okAsync(actor)),
      requireInTenant: () => errAsync(permissionDenied()),
      requireOnResource: () => errAsync(permissionDenied()),
    },
    account: {
      read: (id) => {
        if (faults.account || id !== actor.id) {
          return errAsync(unauthenticated());
        }
        return okAsync(profile);
      },
      update: (id, draft) => {
        if (faults.write || id !== actor.id) {
          return errAsync(providerFailed(undefined));
        }
        profile = { ...profile, ...draft };
        return okAsync(undefined);
      },
    },
    images: {
      upload: (id) => {
        if (faults.upload) {
          return errAsync(providerFailed(undefined));
        }
        const url = `https://files.example/profiles/${id}/new-photo`;
        images.add(url);
        return okAsync(url);
      },
      remove: (_id, url) => {
        if (faults.cleanup) {
          return errAsync(providerFailed(undefined));
        }
        images.delete(url);
        return okAsync(undefined);
      },
    },
    audit: { record: ({ type }) => events.push(type) },
    rateLimiter: createTestRateLimiter(),
  };
  return {
    query: new GetOwnProfile(deps),
    command: new UpdateOwnProfile(deps),
    faults,
    images,
    events,
  };
}
