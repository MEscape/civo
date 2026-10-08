import type { DataIssues } from '../features/map-features';

/**
 * Where "some features were left out" is recorded. The domain only says that
 * it happened; how it is observed (a log line, a metric) is an adapter's
 * decision.
 */
export interface DataIssueReporter {
  report(issues: DataIssues): void;
}
