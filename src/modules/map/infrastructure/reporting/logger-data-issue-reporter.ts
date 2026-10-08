import { logger } from '@lib/logger';

import type { DataIssues } from '../../domain/features/map-features';
import type { DataIssueReporter } from '../../domain/ports/data-issue-reporter.port';

const mapLogger = logger.withContext({ module: 'map' });

/** Dropped features are a recoverable anomaly in external data, so they are logged once per render as `warn`. */
export class LoggerDataIssueReporter implements DataIssueReporter {
  report(issues: DataIssues): void {
    try {
      mapLogger.warn('map.features_dropped', { ...issues });
    } catch {
      // Reporting must never fail the render it describes.
    }
  }
}
