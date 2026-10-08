import { isUniqueConstraintViolation, SqlConnectionError } from '@prisma/orm-family-sql/errors';
import { isStructuredError } from '@prisma/orm-postgres/utils/structured-error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mapPrismaError } from '@lib/db/prisma-error-mapping';

// 1. Mock the Prisma type predicates so we can control error categorization
// without relying on actual Prisma error instances or implementations.
vi.mock('@prisma/orm-postgres/utils/structured-error', () => ({
  isStructuredError: vi.fn(),
}));

vi.mock('@prisma/orm-family-sql/errors', () => ({
  isUniqueConstraintViolation: vi.fn(),
  SqlConnectionError: { is: vi.fn() },
}));

// 2. Mock the application error factories to observe the output straightforwardly.
vi.mock('@lib/errors', () => ({
  conflictError: (code: string, message: string) => ({
    kind: 'conflict',
    code,
    message,
  }),
  notFoundError: (code: string, message: string) => ({
    kind: 'not_found',
    code,
    message,
  }),
  infrastructureError: (code: string, message: string, cause: unknown) => ({
    kind: 'infrastructure',
    code,
    message,
    cause,
  }),
}));

// 3. Mock the logger to verify observability side effects on connection errors.
const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('@lib/logger', () => ({
  logger: {
    withContext: vi.fn(() => ({ warn: mockWarn })),
  },
}));

describe('mapPrismaError', () => {
  const context = {
    code: 'TEST_OP_FAILED',
    message: 'The test operation failed',
  };

  beforeEach(() => {
    // Reset all type predicates to false by default so each test explicitly
    // opts into the error category it intends to test.
    vi.mocked(isStructuredError).mockReturnValue(false);
    vi.mocked(isUniqueConstraintViolation).mockReturnValue(false);
    vi.mocked(SqlConnectionError.is).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps unique constraint violations to a conflict error', () => {
    const error = new Error('Duplicate key value');
    vi.mocked(isUniqueConstraintViolation).mockImplementation((e) => e === error);

    const result = mapPrismaError(error, context);

    expect(result).toEqual({
      kind: 'conflict',
      code: context.code,
      message: context.message,
    });
  });

  it('maps unmapped structured errors to an infrastructure error', () => {
    const error = { code: 'ORM.SOME_OTHER_ERROR' };
    vi.mocked(isStructuredError).mockImplementation((e) => e === error);

    const result = mapPrismaError(error, context);

    expect(result).toEqual({
      kind: 'infrastructure',
      code: context.code,
      message: context.message,
      cause: error,
    });
  });

  it('logs a warning and maps SQL connection errors to an infrastructure error', () => {
    const error = new Error('Connection refused');
    vi.mocked(SqlConnectionError.is).mockImplementation((e) => e === error);

    const result = mapPrismaError(error, context);

    expect(result).toEqual({
      kind: 'infrastructure',
      code: context.code,
      message: context.message,
      cause: error,
    });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith('db.connection_error', {
      mappedTo: context.code,
    });
  });

  it('maps unknown errors to an infrastructure error while preserving the cause', () => {
    const error = new Error('Something entirely unexpected');

    const result = mapPrismaError(error, context);

    expect(result).toEqual({
      kind: 'infrastructure',
      code: context.code,
      message: context.message,
      cause: error,
    });
    // Ensure no false positives triggered the logger
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('evaluates both the outer error and its direct cause when categorizing', () => {
    const innerError = new Error('Duplicate key value');
    const outerError = new Error('Query failed', { cause: innerError });

    // We mock the predicate to only recognize the inner error, proving the mapper
    // correctly unwraps `cause` one level deep.
    vi.mocked(isUniqueConstraintViolation).mockImplementation((e) => e === innerError);

    const result = mapPrismaError(outerError, context);

    expect(result).toEqual({
      kind: 'conflict',
      code: context.code,
      message: context.message,
    });
  });
});
