import { beforeEach, describe, expect, it, vi } from 'vitest';

import { unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { requestScoped } from '@modules/auth/infrastructure/better-auth/current-actor-request-scope';

import { errAsync, okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('next/server', () => ({ connection: mocks.connection }));

const ACTOR: Actor = {
  id: toActorId('user-1'),
  tenantId: toTenantId('site-1'),
  roles: ['viewer'],
};

beforeEach(() => {
  mocks.connection.mockReset();
  mocks.connection.mockResolvedValue(undefined);
});

describe('request-scoped actor construction', () => {
  it('constructs and reads the provider only after the request boundary opens', async () => {
    const gate: { release: () => void } = { release: () => undefined };
    const pending = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    mocks.connection.mockReturnValue(pending);
    const events: string[] = [];
    const provider = requestScoped(() => {
      events.push('constructed');
      return {
        getCurrentActor: () => {
          events.push('read');
          return okAsync(ACTOR);
        },
      };
    });

    expect(events).toEqual([]);
    const result = provider.getCurrentActor();
    expect(events).toEqual([]);
    gate.release();

    expect((await result)._unsafeUnwrap()).toEqual(ACTOR);
    expect(events).toEqual(['constructed', 'read']);
  });

  it('retains the singleton provider while reading fresh identity for each request', async () => {
    let actor = ACTOR;
    const events: string[] = [];
    const provider = requestScoped(() => {
      events.push('constructed');
      return { getCurrentActor: () => okAsync(actor) };
    });

    expect((await provider.getCurrentActor())._unsafeUnwrap()).toEqual(ACTOR);
    actor = { ...ACTOR, tenantId: toTenantId('site-2'), roles: ['employee'] };

    expect((await provider.getCurrentActor())._unsafeUnwrap()).toEqual(actor);
    expect(events).toEqual(['constructed']);
  });

  it('preserves an authentication refusal from the provider', async () => {
    const failure = unauthenticated();
    const provider = requestScoped(() => ({ getCurrentActor: () => errAsync(failure) }));

    expect((await provider.getCurrentActor())._unsafeUnwrapErr()).toEqual(failure);
  });
});
