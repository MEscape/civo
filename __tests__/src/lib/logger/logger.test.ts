import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@lib/logger/logger';

// Mock config to ensure all log levels are emitted during testing
vi.mock('@lib/config', () => ({
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
