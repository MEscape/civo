import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  conflictError,
  forbiddenError,
  infrastructureError,
  notFoundError,
  unauthorizedError,
  validationError,
} from '@lib/errors/factory';
import { orNotFound } from '@lib/errors/or-not-found';
import { err, errAsync, ok, okAsync } from '@lib/result';

const { mockNotFound } = vi.hoisted(() => ({
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));
vi.mock('@lib/logger', () => ({
  logger: { error: vi.fn() },
}));

beforeEach(() => {
  mockNotFound.mockClear();
});

describe('orNotFound', () => {
  describe('synchronous results', () => {
    it('unpacks a successful ok value directly', () => {
      const value = orNotFound(ok({ name: 'test-site' }));
      expect(value).toEqual({ name: 'test-site' });
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('triggers notFound() on forbidden error', () => {
      expect(() => orNotFound(err(forbiddenError('forbidden', 'Forbidden')))).toThrow(
        'NEXT_NOT_FOUND',
      );
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('triggers notFound() on not_found error', () => {
      expect(() => orNotFound(err(notFoundError('site.missing', 'Not found')))).toThrow(
        'NEXT_NOT_FOUND',
      );
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('triggers notFound() on unauthorized error', () => {
      expect(() => orNotFound(err(unauthorizedError('unauthorized', 'Unauthorized')))).toThrow(
        'NEXT_NOT_FOUND',
      );
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('triggers notFound() on validation error', () => {
      expect(() =>
        orNotFound(err(validationError('invalid', 'Invalid input', { id: ['invalid'] }))),
      ).toThrow('NEXT_NOT_FOUND');
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('triggers notFound() on conflict error', () => {
      expect(() => orNotFound(err(conflictError('conflict', 'Conflict')))).toThrow(
        'NEXT_NOT_FOUND',
      );
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('escalates on infrastructure error', () => {
      const error = infrastructureError('db.failed', 'Database unreachable');
      expect(() => orNotFound(err(error))).toThrow(
        expect.objectContaining({ message: 'db.failed', cause: error }),
      );
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });

  describe('asynchronous results', () => {
    it('unpacks an async ok value', async () => {
      const value = await orNotFound(okAsync({ id: 'w-123' }));
      expect(value).toEqual({ id: 'w-123' });
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('triggers notFound() on async forbidden error', async () => {
      await expect(orNotFound(errAsync(forbiddenError('forbidden', 'No access')))).rejects.toThrow(
        'NEXT_NOT_FOUND',
      );
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('escalates on async infrastructure error', async () => {
      const error = infrastructureError('io.failed', 'IO failure');
      await expect(orNotFound(errAsync(error))).rejects.toThrow(
        expect.objectContaining({ message: 'io.failed', cause: error }),
      );
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });
});
