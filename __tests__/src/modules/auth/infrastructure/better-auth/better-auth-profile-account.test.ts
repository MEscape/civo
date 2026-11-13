import { describe, expect, it, vi } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { BetterAuthProfileAccount } from '@modules/auth/infrastructure/better-auth/better-auth-profile-account';

const now = new Date('2026-01-01');
const actorId = toActorId('own-account');
type ProfileApi = ReturnType<ConstructorParameters<typeof BetterAuthProfileAccount>[0]['getApi']>;

function world() {
  const api = {
    getSession: vi.fn<ProfileApi['getSession']>(),
    updateUser: vi.fn<ProfileApi['updateUser']>(),
  };
  api.getSession.mockResolvedValue({
    user: {
      id: actorId,
      name: 'Ada',
      email: 'ada@example.org',
      emailVerified: true,
      image: null,
      createdAt: now,
    },
  });
  api.updateUser.mockResolvedValue({ status: true });
  return {
    api,
    account: new BetterAuthProfileAccount({
      getApi: () => api,
      getHeaders: async () => new Headers(),
    }),
  };
}

describe('BetterAuthProfileAccount', () => {
  it('returns only account fields and writes through the current provider session', async () => {
    const { api, account } = world();
    expect((await account.read(actorId))._unsafeUnwrap()).toEqual({
      name: 'Ada',
      email: 'ada@example.org',
      emailVerified: true,
      image: null,
      createdAt: now,
    });
    expect((await account.update(actorId, { name: 'Ada Lovelace', image: null })).isOk()).toBe(
      true,
    );
    expect(api.updateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { name: 'Ada Lovelace', image: null },
    });
  });

  it('refuses a missing session and a session belonging to another actor', async () => {
    const { api, account } = world();
    expect(
      (await account.update(toActorId('another-account'), { name: 'Forged' }))._unsafeUnwrapErr()
        .kind,
    ).toBe('unauthorized');
    api.getSession.mockResolvedValue(null);
    expect((await account.read(actorId))._unsafeUnwrapErr().kind).toBe('unauthorized');
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it('preserves provider causes without exposing their messages to the client', async () => {
    const { api, account } = world();
    const cause = new Error('Private provider details');
    api.updateUser.mockRejectedValue(cause);
    const failure = (await account.update(actorId, { name: 'Ada' }))._unsafeUnwrapErr();
    expect(failure.kind).toBe('infrastructure');
    if (failure.kind !== 'infrastructure') {
      throw new Error('Expected infrastructure failure');
    }
    expect(failure.cause).toBe(cause);
    expect(failure.message).not.toContain('Private');
  });
});
