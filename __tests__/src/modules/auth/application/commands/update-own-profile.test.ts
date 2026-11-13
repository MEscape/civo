import { describe, expect, it } from 'vitest';

import { profileWorld } from '../support/profile-world';

const photo = {
  contentType: 'image/png',
  bytes: Uint8Array.from(Buffer.from('89504e470d0a1a0a', 'hex')),
};

describe('UpdateOwnProfile', () => {
  it('edits the caller without requiring website membership and preserves identity and photo', async () => {
    const world = profileWorld();
    const original = (await world.query.execute())._unsafeUnwrap();
    expect((await world.command.execute({ name: '  Ada Lovelace ' })).isOk()).toBe(true);
    expect((await world.query.execute())._unsafeUnwrap()).toEqual({
      ...original,
      name: 'Ada Lovelace',
    });
    expect(world.events).toEqual(['authentication.profile_updated']);
  });

  it.each(['anonymous', 'account'] as const)(
    'refuses %s access before changing files or profile',
    async (fault) => {
      const world = profileWorld();
      world.faults[fault] = true;
      expect(
        (await world.command.execute({ name: 'Another', image: photo }))._unsafeUnwrapErr().kind,
      ).toBe('unauthorized');
      expect(world.images.size).toBe(1);
      expect(world.events).toEqual([]);
    },
  );

  it('rejects invalid image bytes and leaves stored data intact', async () => {
    const world = profileWorld();
    expect(
      (
        await world.command.execute({ name: 'Ada', image: { ...photo, bytes: new Uint8Array() } })
      )._unsafeUnwrapErr().kind,
    ).toBe('validation');
    expect(world.images.size).toBe(1);
    expect(world.events).toEqual([]);
  });

  it('replaces and removes a photo, deleting only the superseded objects', async () => {
    const world = profileWorld();
    expect((await world.command.execute({ name: 'Ada', image: photo })).isOk()).toBe(true);
    expect([...world.images]).toEqual(['https://files.example/profiles/own-account/new-photo']);
    expect((await world.command.execute({ name: 'Ada', image: null })).isOk()).toBe(true);
    expect((await world.query.execute())._unsafeUnwrap().image).toBeNull();
    expect(world.images.size).toBe(0);
  });

  it.each(['upload', 'write'] as const)(
    'preserves old data after %s failure and cleans a new upload',
    async (fault) => {
      const world = profileWorld();
      world.faults[fault] = true;
      expect((await world.command.execute({ name: 'Changed', image: photo })).isErr()).toBe(true);
      expect((await world.query.execute())._unsafeUnwrap().name).toBe('Ada');
      expect([...world.images]).toEqual(['https://files.example/profiles/own-account/old-photo']);
      expect(world.events).toEqual([]);
    },
  );

  it('reports a committed save as success even if old photo cleanup fails', async () => {
    const world = profileWorld();
    world.faults.cleanup = true;
    expect((await world.command.execute({ name: 'Changed', image: null })).isOk()).toBe(true);
    expect((await world.query.execute())._unsafeUnwrap()).toMatchObject({
      name: 'Changed',
      image: null,
    });
  });

  it('bounds writes per account and preserves the last accepted profile', async () => {
    const world = profileWorld();
    for (let i = 0; i < 20; i++) {
      expect((await world.command.execute({ name: `Ada ${i}` })).isOk()).toBe(true);
    }
    expect((await world.command.execute({ name: 'Over budget' }))._unsafeUnwrapErr().kind).toBe(
      'rate_limited',
    );
    expect((await world.query.execute())._unsafeUnwrap().name).toBe('Ada 19');
  });
});
