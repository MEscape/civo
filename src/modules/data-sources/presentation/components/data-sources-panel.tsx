'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { DataPanel } from '@components/shared/data-panel';
import { UnsavedChangesGuard } from '@components/shared/unsaved-changes-guard';
import { Alert } from '@components/ui/alert';
import { Button, buttonVariants } from '@components/ui/button';
import { ArrowRight, Check, UploadCloud } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { dataSourceRoutes } from '../routes';

import { ConfiguredSourceCard } from './configured-source-card';
import { DataSourceForm } from './data-source-form';
import { DataSourcesGuide } from './data-sources-guide';
import { DeleteDataContext } from './delete-data-context';

import type { GuideStep } from './data-sources-guide';
import type { ComponentAwaitingData, DatasetUsage } from './dataset-management-item';
import type { DeleteDataAction } from './delete-data-context';
import type { DataSourceDto } from '../dto/data-source-dto';

export interface DataSourcesPanelProps {
  readonly websiteId: string;
  /** The sources on this page of the list. */
  readonly sources: readonly DataSourceDto[];
  /** Every source of the website, not only this page. */
  readonly total: number;
  /** The page links, drawn in the list's footer when there is more than one page. */
  readonly pagination?: ReactNode;
  /** Which pages use each dataset; `null` when unknown. */
  readonly usage: DatasetUsage;
  /** Deletes data once no page shows it; see `DeleteDataAction`. */
  readonly deleteData: DeleteDataAction;
  /** Components still showing sample data, where a dataset goes next. */
  readonly awaiting: readonly ComponentAwaitingData[];
}

/** The setup steps, ticked off from what exists. */
function guideSteps(
  total: number,
  sources: readonly DataSourceDto[],
  usage: DatasetUsage,
): readonly GuideStep[] {
  // shortcut: datasets and mappings are judged from the sources on this page; good enough
  // while a website has a handful of sources, ask the server once lists grow past one page.
  const datasets = sources.flatMap((source) => source.datasets);
  return [
    { id: 'source', isDone: total > 0 },
    { id: 'dataset', isDone: datasets.length > 0 },
    { id: 'mapping', isDone: datasets.some((dataset) => dataset.mapping !== null) },
    // A page in the editor counts; the live site alone means it was used and since taken off.
    {
      id: 'use',
      isDone: Object.values(usage ?? {}).some((pages) => pages.some((page) => !page.isLive)),
    },
  ];
}

/**
 * Where the first dataset goes: a component still showing sample data that
 * asks for the kind of a mapped dataset, else one asking for any dataset's
 * kind. `undefined` when no page has such a component; then the pages are
 * where one is added.
 */
function nextComponentFor(
  sources: readonly DataSourceDto[],
  awaiting: readonly ComponentAwaitingData[],
): ComponentAwaitingData | undefined {
  const datasets = sources.flatMap((source) => source.datasets);
  const mapped = new Set<string>(
    datasets.filter((dataset) => dataset.mapping !== null).map((dataset) => dataset.canonicalKind),
  );
  const any = new Set<string>(datasets.map((dataset) => dataset.canonicalKind));
  return (
    awaiting.find((component) => mapped.has(component.kind)) ??
    awaiting.find((component) => any.has(component.kind))
  );
}

type NextComponent = ReturnType<typeof nextComponentFor>;

/** Everything is connected and mapped; the one thing left is a component that reads it. */
function ReadyForUseNotice({
  websiteId,
  target,
}: {
  readonly websiteId: string;
  readonly target: NextComponent;
}) {
  const t = useTranslations('dataSources');
  return (
    <Alert variant="success" role="status">
      {/* One child, so the icon sits in the row instead of the alert's absolute icon slot. */}
      <div className="flex flex-wrap items-center gap-3">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-copy">
          {target === undefined
            ? t('guide.ready')
            : t('guide.readyFor', { page: target.page, component: target.label })}
        </p>
        <Link
          href={target?.href ?? dataSourceRoutes.builder(websiteId)}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {target === undefined ? t('guide.openPages') : t('guide.assign')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Alert>
  );
}

export function DataSourcesPanel({
  websiteId,
  sources,
  total,
  pagination,
  usage,
  deleteData,
  awaiting,
}: DataSourcesPanelProps) {
  const t = useTranslations('dataSources');
  const [isCreating, setIsCreating] = useState(false);
  // One mapping open on the whole screen: opening another closes it, after asking if it holds unsaved work.
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [isMappingDirty, setIsMappingDirty] = useState(false);
  const [pendingExpand, setPendingExpand] = useState<{ readonly id: string | null } | null>(null);

  const requestExpand = (datasetId: string | null) => {
    if (isMappingDirty && datasetId !== expandedDatasetId) {
      setPendingExpand({ id: datasetId });
      return;
    }
    setExpandedDatasetId(datasetId);
  };

  const steps = guideSteps(total, sources, usage);
  const isSetUp = steps.every((step) => step.isDone);
  // Everything is ready but no page shows it yet: one clear next step instead of the whole guide.
  const isOnlyUseLeft =
    !isSetUp && steps.filter((step) => step.id !== 'use').every((step) => step.isDone);
  // The guide stays until a component really reads the data; the note beside it says what to do now.
  const showsGuide = !isSetUp;
  const target = nextComponentFor(sources, awaiting);
  const startCreating = () => {
    setIsCreating(true);
  };

  const createForm = isCreating && (
    <DataPanel title={t('panel.createTitle')} description={t('panel.createIntro')}>
      <div className="p-4 sm:p-6">
        <DataSourceForm
          websiteId={websiteId}
          onCancel={() => {
            setIsCreating(false);
          }}
          onSaved={() => {
            setIsCreating(false);
          }}
        />
      </div>
    </DataPanel>
  );

  const sourceList =
    total === 0 ? (
      !isCreating && (
        <EmptyState
          variant="outlined"
          className="py-10"
          icon={<UploadCloud className="size-8" aria-hidden="true" />}
          title={t('panel.emptyTitle')}
          description={t('panel.emptyDescription')}
          action={<Button onClick={startCreating}>{t('panel.newSource')}</Button>}
        />
      )
    ) : (
      <DataPanel
        title={t('panel.connected', { count: total })}
        actions={
          !isCreating && (
            <Button size="sm" onClick={startCreating}>
              {t('panel.newSource')}
            </Button>
          )
        }
        footer={pagination}
      >
        <ul className="divide-y divide-border">
          {sources.map((source) => (
            <li key={source.id}>
              <ConfiguredSourceCard
                source={source}
                usage={usage}
                expandedDatasetId={expandedDatasetId}
                onExpandDataset={requestExpand}
                onMappingDirtyChange={setIsMappingDirty}
              />
            </li>
          ))}
        </ul>
      </DataPanel>
    );

  // Like the overview: the work in the wide column, the guide beside it until every step is done,
  // then it goes, as the onboarding card does.
  return (
    <DeleteDataContext.Provider value={deleteData}>
      <UnsavedChangesGuard
        title={t('leave.title')}
        description={t('leave.description')}
        confirmLabel={t('leave.confirm')}
        cancelLabel={t('leave.stay')}
      >
        <div className="space-y-6">
          {isOnlyUseLeft && <ReadyForUseNotice websiteId={websiteId} target={target} />}
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className={showsGuide ? 'space-y-6 lg:col-span-2' : 'space-y-6 lg:col-span-3'}>
              {createForm}
              {sourceList}
            </div>
            {showsGuide && <DataSourcesGuide steps={steps} />}
          </div>
        </div>
        <ConfirmDialog
          open={pendingExpand !== null}
          title={t('leave.mappingTitle')}
          description={t('leave.mappingDescription')}
          confirmLabel={t('leave.confirm')}
          cancelLabel={t('leave.stay')}
          onConfirm={() => {
            setExpandedDatasetId(pendingExpand?.id ?? null);
            setPendingExpand(null);
          }}
          onCancel={() => {
            setPendingExpand(null);
          }}
        />
      </UnsavedChangesGuard>
    </DeleteDataContext.Provider>
  );
}
