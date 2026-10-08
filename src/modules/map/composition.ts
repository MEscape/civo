import 'server-only';

import { BuildMapModel } from './application/queries/build-map-model';
import { LoggerDataIssueReporter } from './infrastructure/reporting/logger-data-issue-reporter';
import { createMapSection } from './presentation/components/map-section';

/**
 * The module's composition root: the one file that knows both the use case
 * and its adapter. The map reads no resource of its own, so it reaches no
 * other module; hosts hand it layers they already loaded and authorized.
 */
const buildMapModel = new BuildMapModel({
  reporter: new LoggerDataIssueReporter(),
});

/** The server half of the map, wired with its use case. */
export const MapSection = createMapSection({
  buildMapModel: (input) => buildMapModel.execute(input),
});
