import { logger } from '@lib/logger';
import { MS_PER_DAY } from '@lib/utils';

import type { pruneBookings } from '../../application/services/prune-bookings';

/**
 * Runs the retention once now and then daily. The app is one long-lived Node.js server, so the
 * process's own timer is the schedule; several instances deleting the same old rows is harmless. A
 * failed run is logged by the store and retried the next day. `unref` lets the process exit without
 * waiting for it.
 */
export function startDailyRetention(
  prune: () => ReturnType<typeof pruneBookings>,
  retentionDays: number,
): void {
  const run = () => {
    void prune().map((outcome) => {
      logger.info('booking.retention.pruned', { ...outcome, retentionDays });
    });
  };
  run();
  setInterval(run, MS_PER_DAY).unref();
}
