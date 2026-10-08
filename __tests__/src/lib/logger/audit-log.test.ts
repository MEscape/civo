import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuditLog } from '@lib/logger/audit-log';
import { logger } from '@lib/logger/logger';

type ShopEvent =
  | { readonly type: 'shop.created'; readonly shopId: string }
  | { readonly type: 'shop.failed'; readonly reason: string };

describe('createAuditLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs each event once, at the level chosen for its type, with the rest as context', () => {
    const info = vi.fn();
    const warn = vi.fn();
    vi.spyOn(logger, 'withContext').mockReturnValue({ debug: vi.fn(), info, warn, error: vi.fn() });
    const audit = createAuditLog<ShopEvent['type']>('shop.audit', {
      'shop.created': 'info',
      'shop.failed': 'warn',
    });

    const created: ShopEvent = { type: 'shop.created', shopId: 's1' };
    const failed: ShopEvent = { type: 'shop.failed', reason: 'boom' };
    audit.record(created);
    audit.record(failed);

    expect(logger.withContext).toHaveBeenCalledWith({ module: 'shop.audit' });
    expect(info).toHaveBeenCalledWith('shop.created', { shopId: 's1' });
    expect(warn).toHaveBeenCalledWith('shop.failed', { reason: 'boom' });
  });

  it('never fails the request it describes', () => {
    const failing = () => {
      throw new Error('sink down');
    };
    vi.spyOn(logger, 'withContext').mockReturnValue({
      debug: failing,
      info: failing,
      warn: failing,
      error: failing,
    });
    const audit = createAuditLog<ShopEvent['type']>('shop.audit', {
      'shop.created': 'info',
      'shop.failed': 'warn',
    });

    const created: ShopEvent = { type: 'shop.created', shopId: 's1' };
    expect(() => {
      audit.record(created);
    }).not.toThrow();
  });
});
