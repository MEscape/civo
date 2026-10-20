import { isUniqueConstraintViolation, SqlQueryError } from '@prisma/orm-family-sql/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPersistenceFailures } from '@lib/db/persistence-failures';
import { conflictError, notFoundError } from '@lib/errors';

// The driver's own predicates are the boundary being faked: real driver errors need a database.
vi.mock('@prisma/orm-family-sql/errors', () => ({
  isUniqueConstraintViolation: vi.fn(),
  SqlQueryError: { is: vi.fn() },
}));

const { mockError } = vi.hoisted(() => ({ mockError: vi.fn() }));
vi.mock('@lib/logger', () => ({
  logger: { withContext: vi.fn(() => ({ error: mockError })) },
}));

const failures = createPersistenceFailures({
  module: 'shop.persistence',
  code: 'shop.persistence_failed',
  subject: 'Shop',
});

const onConflict = () => conflictError('shop.slug_taken', 'Slug taken.');

beforeEach(() => {
  vi.mocked(isUniqueConstraintViolation).mockReturnValue(false);
  vi.mocked(SqlQueryError.is).mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('orConflict', () => {
  it('turns a unique violation into the module’s own conflict, without logging it', () => {
    const thrown = new Error('duplicate key');
    vi.mocked(isUniqueConstraintViolation).mockImplementation((e) => e === thrown);

    expect(failures.orConflict('create', onConflict)(thrown)).toEqual(onConflict());
    expect(mockError).not.toHaveBeenCalled();
  });

  it('turns an exclusion violation into a conflict too', () => {
    const thrown = Object.assign(new Error('overlap'), { sqlState: '23P01' });
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);

    expect(failures.orConflict('create', onConflict)(thrown).kind).toBe('conflict');
  });

  it('also looks one level down, at the cause', () => {
    const inner = new Error('duplicate key');
    const outer = new Error('query failed', { cause: inner });
    vi.mocked(isUniqueConstraintViolation).mockImplementation((e) => e === inner);

    expect(failures.orConflict('create', onConflict)(outer).kind).toBe('conflict');
  });

  it('does not take another query error for a conflict', () => {
    const thrown = Object.assign(new Error('syntax error'), { sqlState: '42601' });
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);

    expect(failures.orConflict('create', onConflict)(thrown).kind).toBe('infrastructure');
  });
});

describe('an infrastructure failure', () => {
  it.each([
    ['infraOnly', () => failures.infraOnly('findById')],
    ['orConflict', () => failures.orConflict('create', onConflict)],
  ])('from %s keeps the thrown error as the cause behind a generic message', (_name, translate) => {
    const thrown = new Error('connection refused to db.internal:5432');

    expect(translate()(thrown)).toEqual({
      kind: 'infrastructure',
      code: 'shop.persistence_failed',
      message: expect.stringMatching(/^Shop persistence failed during /),
      cause: thrown,
    });
  });

  it('is logged once, with the operation', () => {
    const thrown = new Error('boom');

    failures.infraOnly('findById')(thrown);

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith('findById failed', thrown, { operation: 'findById' });
  });

  it('is what infraOnly answers even to a unique violation, which that operation cannot cause', () => {
    const thrown = new Error('duplicate key');
    vi.mocked(isUniqueConstraintViolation).mockReturnValue(true);

    expect(failures.infraOnly('findById')(thrown).kind).toBe('infrastructure');
  });

  it('is never an AppError handed back as it was thrown', () => {
    const thrown = notFoundError('shop.not_found', 'gone');

    expect(failures.infraOnly('findById')(thrown)).toMatchObject({
      kind: 'infrastructure',
      cause: thrown,
    });
  });
});

describe('requireRow', () => {
  const requireShop = failures.requireRow(() => notFoundError('shop.not_found', 'gone'));

  it('passes a row through', () => {
    const row = { id: 's1' };

    expect(requireShop(row)._unsafeUnwrap()).toBe(row);
  });

  it('answers the module’s not-found when the write matched nothing', () => {
    expect(requireShop(null)._unsafeUnwrapErr()).toMatchObject({ kind: 'not_found' });
  });
});

describe('the cause chain', () => {
  it('finds a unique violation several levels down', () => {
    const driver = new Error('duplicate key');
    const wrapped = new Error('prepared statement failed again', { cause: driver });
    const outer = new Error('query failed', { cause: wrapped });
    vi.mocked(isUniqueConstraintViolation).mockImplementation((e) => e === driver);

    expect(failures.orConflict('create', onConflict)(outer).kind).toBe('conflict');
  });

  it('ends on a chain that loops back on itself', () => {
    const a = new Error('a');
    const b = new Error('b', { cause: a });
    Object.defineProperty(a, 'cause', { value: b });

    expect(failures.orConflict('create', onConflict)(a).kind).toBe('infrastructure');
  });
});

describe('what a failure log names', () => {
  const driverError = {
    sqlState: '23503',
    constraint: 'booking_resource_fk',
    table: 'BookingResource',
    column: 'resourceId',
    detail: 'Key (resourceId)=(jane.doe@example.org) is not present in table "Resource".',
  };

  it('is the SQLSTATE, constraint and table, found anywhere in the chain', () => {
    const outer = new Error('query failed', { cause: Object.assign(new Error('x'), driverError) });
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e instanceof Error && 'sqlState' in e);

    failures.infraOnly('save')(outer);

    expect(mockError).toHaveBeenCalledWith('save failed', outer, {
      operation: 'save',
      sqlState: '23503',
      constraint: 'booking_resource_fk',
      table: 'BookingResource',
    });
  });

  it('never carries the detail, which can quote the offending row', () => {
    const thrown = Object.assign(new Error('x'), driverError);
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);

    failures.infraOnly('save')(thrown);

    expect(JSON.stringify(mockError.mock.calls[0]?.[2])).not.toContain('jane.doe');
  });

  it('leaves out what the database did not name', () => {
    const thrown = Object.assign(new Error('x'), { sqlState: '57014' });
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);

    failures.infraOnly('save')(thrown);

    expect(mockError.mock.calls[0]?.[2]).toEqual({ operation: 'save', sqlState: '57014' });
  });
});
