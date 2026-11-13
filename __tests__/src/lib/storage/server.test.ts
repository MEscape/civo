import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@lib/config/server', () => ({ serverEnv: {} }));

beforeEach(() => {
  vi.resetModules();
});

describe('getObjectStore', () => {
  it('builds its store once, on first use, not when it is imported', async () => {
    const store = {};
    const createObjectStore = vi.fn(() => store);
    vi.doMock('@lib/storage/create-object-store', () => ({ createObjectStore }));
    const { getObjectStore } = await import('@lib/storage/server');
    expect(createObjectStore).not.toHaveBeenCalled();

    expect(getObjectStore()).toBe(store);
    expect(getObjectStore()).toBe(store);

    expect(createObjectStore).toHaveBeenCalledTimes(1);
  });
});
