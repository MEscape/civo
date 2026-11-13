import { dataSourceRoutes } from '../routes';

import type { DatasetSetupView } from '../../application/contracts/dataset-views';
import type { GuideStep } from '../components/setup/data-sources-guide';
import type { DataSourceDto } from '../dto/data-source-dto';
import type { ComponentAwaitingData, DatasetUsage } from '../dto/dataset-usage-dto';

const GUIDE_STEP_IDS = ['source', 'dataset', 'mapping', 'use'] as const;

interface SetupGuideInput {
  readonly websiteId: string;
  /** The sources on this page of the list: the guide points at the first dataset that needs work. */
  readonly sources: readonly DataSourceDto[];
  /** Every source of the website, not only this page. */
  readonly total: number;
  readonly setup: DatasetSetupView;
  readonly usage: DatasetUsage;
  readonly awaiting: readonly ComponentAwaitingData[];
}

/**
 * How far the way from a first source to data on a page has come, read from what exists. Only the
 * first step still open gets a button, so there is one next thing to do and not four.
 */
export function buildSetupGuide({
  websiteId,
  sources,
  total,
  setup,
  usage,
  awaiting,
}: SetupGuideInput) {
  const readySource = sources.find((source) => source.status === 'OK');
  const unmapped = sources
    .flatMap((source) => source.datasets.map((dataset) => ({ source, dataset })))
    .find(({ dataset }) => dataset.mapping === null);
  const done = [
    total > 0,
    setup.kinds.length > 0,
    setup.mappedKinds.length > 0,
    // A draft page reads a dataset; a saved map alone does not put data on a page yet.
    Object.values(usage ?? {}).some((uses) => uses.some((use) => use.where === 'draft')),
  ];
  const firstOpen = done.indexOf(false);
  const hrefs = [
    undefined,
    readySource === undefined ? undefined : dataSourceRoutes.datasetNew(websiteId, readySource.id),
    unmapped === undefined
      ? undefined
      : dataSourceRoutes.datasetMapping(websiteId, unmapped.source.id, unmapped.dataset.id),
    undefined,
  ];
  const steps: readonly GuideStep[] = GUIDE_STEP_IDS.map((id, index) => ({
    id,
    isDone: done[index] === true,
    href: index === firstOpen ? hrefs[index] : undefined,
  }));
  const isSetUp = steps.every((step) => step.isDone);

  return {
    steps,
    // The guide stays until a component really reads the data; the note says what to do now.
    showsGuide: !isSetUp,
    // Everything is ready but no page shows it yet: one clear next step instead of the whole guide.
    isOnlyUseLeft:
      !isSetUp && steps.filter((step) => step.id !== 'use').every((step) => step.isDone),
    target:
      awaiting.find((component) => setup.mappedKinds.some((kind) => kind === component.kind)) ??
      awaiting.find((component) => setup.kinds.some((kind) => kind === component.kind)),
  };
}
