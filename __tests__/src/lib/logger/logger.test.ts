import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@lib/logger/logger';

// Mock config to ensure all log levels are emitted during testing
vi.mock('@lib/config/server', () => ({
  serverEnv: {
    LOG_LEVEL: 'debug',
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const getParsedLog = (spy: any) => JSON.parse(spy.mock.calls[0][0]);

describe('logger', () => {
  describe('basic logging', () => {
    it('emits structured JSON to console.log for info/warn/debug', () => {
      logger.info('System started', { moduleId: 'core' });

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(getParsedLog(console.log)).toEqual({
        level: 'info',
        message: 'System started',
        timestamp: '2026-09-28T12:00:00.000Z',
        context: { moduleId: 'core' },
      });
    });

    it('emits structured JSON to console.error for error level', () => {
      const err = new Error('Database disconnected');
      logger.error('Connection failed', err, { attempt: 3 });

      expect(console.error).toHaveBeenCalledTimes(1);
      const parsed = getParsedLog(console.error);

      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Connection failed');
      expect(parsed.context).toEqual({ attempt: 3 });
      expect(parsed.error).toMatchObject({
        name: 'Error',
        message: 'Database disconnected',
      });
      expect(parsed.error.stack).toBeDefined();
    });

    it('names an AppError by its kind and code instead of "[object Object]"', () => {
      const cause = new Error('socket hang up');
      logger.error('Dataset source failed', {
        kind: 'infrastructure',
        code: 'data_source.connection_failed',
        message: 'internal',
        cause,
      });

      const parsed = getParsedLog(console.error);
      expect(parsed.error).toEqual({
        name: 'infrastructure',
        message: 'data_source.connection_failed',
        stack: cause.stack,
      });
    });

    it('gracefully handles non-Error objects thrown into logger.error', () => {
      logger.error('Something weird happened', 'just a string');

      const parsed = getParsedLog(console.error);
      expect(parsed.error).toEqual({
        name: 'UnknownError',
        message: 'just a string',
      });
    });
  });

  describe('redaction and sanitization', () => {
    it('redacts sensitive keys case-insensitively', () => {
      logger.debug('Auth event', {
        password: 'cleartext_password',
        TOKEN: 'jwt_123',
        Api_Key: 'sk_live_abc',
        authorization: 'Bearer foo',
        publicField: 'safe',
      });

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        password: '[REDACTED]',
        TOKEN: '[REDACTED]',
        Api_Key: '[REDACTED]',
        authorization: '[REDACTED]',
        publicField: 'safe',
      });
    });

    it('redacts sensitive keys nested deeply in arrays and objects', () => {
      logger.info('Batch process', {
        users: [
          { id: 1, secret: 'x', profile: { cookie: 'session=1' } },
          { id: 2, secret: 'y', profile: { cookie: 'session=2' } },
        ],
      });

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        users: [
          { id: 1, secret: '[REDACTED]', profile: { cookie: '[REDACTED]' } },
          { id: 2, secret: '[REDACTED]', profile: { cookie: '[REDACTED]' } },
        ],
      });
    });

    it('replaces circular references with a placeholder instead of throwing', () => {
      const circular: Record<string, unknown> = { name: 'cycle' };
      circular['self'] = circular;

      logger.info('Cyclic context', circular);

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        name: 'cycle',
        self: '[Circular]',
      });
    });

    it('redacts a key that merely contains a sensitive word, in any spelling', () => {
      logger.info('Spellings', {
        accessToken: 'a',
        refresh_token: 'b',
        newPassword: 'c',
        'x-api-key': 'd',
        'Set-Cookie': 'e',
        AUTH_SECRET: 'f',
        clientSecret: 'g',
        requestId: 'safe',
      });

      expect(getParsedLog(console.log).context).toEqual({
        accessToken: '[REDACTED]',
        refresh_token: '[REDACTED]',
        newPassword: '[REDACTED]',
        'x-api-key': '[REDACTED]',
        'Set-Cookie': '[REDACTED]',
        AUTH_SECRET: '[REDACTED]',
        clientSecret: '[REDACTED]',
        requestId: 'safe',
      });
    });

    it('logs an object referenced twice as data, not as a cycle', () => {
      const shared = { id: 7 };

      logger.info('Shared', { first: shared, second: shared });

      expect(getParsedLog(console.log).context).toEqual({
        first: { id: 7 },
        second: { id: 7 },
      });
    });

    it('cuts off nesting deeper than any context is meant to be', () => {
      let nested: Record<string, unknown> = { leaf: true };
      for (let level = 0; level < 50; level += 1) {
        nested = { nested };
      }

      logger.info('Deep', nested);

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(getParsedLog(console.log).context).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[Truncated]'));
    });

    it('writes a bigint as text instead of throwing', () => {
      logger.info('Big', { count: 10n });

      expect(getParsedLog(console.log).context).toEqual({ count: '10' });
    });

    it('never throws into the caller when the context cannot be serialized', () => {
      const hostile = {
        get boom(): string {
          throw new Error('getter exploded');
        },
      };

      expect(() => {
        logger.error('Hostile', new Error('x'), hostile);
      }).not.toThrow();

      const parsed = getParsedLog(console.error);
      expect(parsed.message).toBe('Hostile');
      expect(parsed.context).toBe('[Unserializable]');
    });

    it('treats opaque types like Dates and Classes as strings without recursing', () => {
      class CustomService {
        password = 'should_not_be_seen'; // Class properties are technically opaque to isPlainObject
      }

      logger.info('Opaque types', {
        date: new Date('2026-01-01T00:00:00Z'),
        service: new CustomService(),
      });

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        date: '2026-01-01T00:00:00.000Z',
        service: '[object Object]',
      });
    });
  });

  describe('withContext', () => {
    it('returns a bound logger that merges base context with specific context', () => {
      const requestLogger = logger.withContext({ requestId: 'req-123' });

      requestLogger.info('Step 1', { step: 1 });

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        requestId: 'req-123',
        step: 1,
      });
    });

    it('binds the context to every level', () => {
      const moduleLogger = logger.withContext({ module: 'payments' });

      moduleLogger.debug('d');
      moduleLogger.info('i');
      moduleLogger.warn('w');

      const levels = vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(levels.map((entry) => entry.level)).toEqual(['debug', 'info', 'warn']);
      expect(levels.every((entry) => entry.context.module === 'payments')).toBe(true);
    });

    it('allows overriding base context properties with specific context', () => {
      const moduleLogger = logger.withContext({
        module: 'payments',
        retry: false,
      });

      moduleLogger.warn('Retrying', { retry: true });

      const parsed = getParsedLog(console.log);
      expect(parsed.context).toEqual({
        module: 'payments',
        retry: true,
      });
    });
  });
});

describe('logger context edge cases', () => {
  it('writes an invalid Date as text instead of throwing', () => {
    logger.info('Dates', { at: new Date('nope') });

    expect(getParsedLog(console.log).context).toEqual({ at: 'Invalid Date' });
  });

  it('keeps arrays of plain data, redacting inside them', () => {
    logger.info('List', { items: [{ token: 'a' }, 'plain', 3] });

    expect(getParsedLog(console.log).context).toEqual({
      items: [{ token: '[REDACTED]' }, 'plain', 3],
    });
  });

  it('logs without a context', () => {
    logger.info('Bare');

    expect(getParsedLog(console.log)).not.toHaveProperty('context');
  });
});

describe('logger.error with unusual errors', () => {
  it('names an AppError without a cause by its kind and code alone', () => {
    logger.error('Failed', { kind: 'not_found', code: 'site.not_found', message: 'm' });

    expect(getParsedLog(console.error).error).toEqual({
      name: 'not_found',
      message: 'site.not_found',
    });
  });

  it('does not throw for a thrown value that cannot be converted to text', () => {
    expect(() => {
      logger.error('Failed', Object.create(null));
    }).not.toThrow();

    expect(getParsedLog(console.error).error).toEqual({
      name: 'UnknownError',
      message: '[unprintable value]',
    });
  });
});
