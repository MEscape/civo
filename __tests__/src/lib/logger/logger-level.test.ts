import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

async function loggerAt(level: 'debug' | 'info' | 'warn' | 'error') {
  vi.resetModules();
  vi.doMock('@lib/config/server', () => ({ serverEnv: { LOG_LEVEL: level } }));
  return (await import('@lib/logger/logger')).logger;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('@lib/config/server');
});

describe('LOG_LEVEL', () => {
  it('drops everything below the configured level before it reaches the sink', async () => {
    const logger = await loggerAt('warn');

    logger.debug('d');
    logger.info('i');
    logger.withContext({ module: 'x' }).info('i2');
    logger.warn('w');
    logger.error('e', new Error('boom'));

    expect(
      vi.mocked(console.log).mock.calls.map(([line]) => JSON.parse(String(line)).message),
    ).toEqual(['w']);
    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
  });

  it('emits only errors at the highest level', async () => {
    const logger = await loggerAt('error');

    logger.warn('w');
    logger.error('e', 'x');

    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('emits every level at the lowest, through a bound logger too', async () => {
    const logger = await loggerAt('debug');
    const bound = logger.withContext({ module: 'm' });

    bound.debug('d');
    bound.info('i');
    bound.warn('w');
    bound.error('e', new Error('x'));

    expect(console.log).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
