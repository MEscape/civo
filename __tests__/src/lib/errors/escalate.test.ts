import { beforeEach, describe, expect, it, vi } from 'vitest';

import { escalate } from '@lib/errors/escalate';
import { infrastructureError } from '@lib/errors/factory';

const { mockError } = vi.hoisted(() => ({ mockError: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@lib/logger', () => ({ logger: { error: mockError } }));

beforeEach(() => {
  mockError.mockClear();
});

describe('escalate', () => {
  it('logs the error once and throws it to the nearest error boundary', () => {
    const error = infrastructureError('site.load_failed', 'Could not load.', new Error('db down'));

    expect(() => escalate(error)).toThrow(
      expect.objectContaining({ message: 'site.load_failed', cause: error }),
    );
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith('route.failed', error, { code: 'site.load_failed' });
  });
});
