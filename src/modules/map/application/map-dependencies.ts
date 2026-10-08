import type { DataIssueReporter } from '../domain/ports/data-issue-reporter.port';

/** What the map's use cases are built from. */
export interface MapDependencies {
  readonly reporter: DataIssueReporter;
}
