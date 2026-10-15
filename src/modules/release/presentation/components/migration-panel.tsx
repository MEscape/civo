'use client';

import { useId, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

import { DataPanel } from '@components/shared/data-panel';
import { FieldMessage } from '@components/shared/field-message';
import { ProcessSteps } from '@components/shared/process-steps';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Check, RefreshCw, Spinner } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useAppFormatters, useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { proposeMigrationAction } from '../actions/propose-migration-action';
import { messageKeyForError } from '../messages/message-keys';

import { ApplyResult } from './apply-result';
import { MigrationHistoryList } from './migration-history-list';
import { MigrationReview } from './migration-review';
import { PagePathLabel } from './page-path-label';
import { PlanCounts } from './plan-counts';

import type {
  ComponentUpdateView,
  PublicationStatusView,
} from '../../application/contracts/release-views';
import type { MigrationHistoryDto } from '../dto/migration-history-dto';
import type { MigrationProposalDto } from '../dto/migration-plan-dto';
import type { ApplyMigrationResultDto } from '../dto/migration-result-dto';
import type { MessageKey } from '../messages/message-keys';

export interface MigrationPanelProps {
  readonly websiteId: string;
  /** Loaded by the Server Component, so the list renders without a client fetch. */
  readonly history: MigrationHistoryDto;
  /** Every update ever proposed, not only this page of them. */
  readonly historyTotal: number;
  /** What the live release holds against today's components; `null` while nothing is live. */
  readonly updates: PublicationStatusView['componentUpdates'];
  /** The names people know components by, by type; a type without one is shown as it is. */
  readonly componentLabels: Readonly<Record<string, string>>;
  /** When the state above was read (ISO): it is computed on every request, so this is how fresh it is. */
  readonly checkedAt: string;
  /** Checking and applying need the publish permission; without it only the state and the history are drawn. */
  readonly mayRun: boolean;
  /** The history's page links, drawn inside it. */
  readonly children?: ReactNode;
}

type Updates = NonNullable<MigrationPanelProps['updates']>;

const STATUS_VARIANTS = {
  upgradable: 'success',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const satisfies Record<ComponentUpdateView['status'], 'success' | 'warning' | 'danger'>;

/** A proposal needs review only if something was recorded and something is out of date. */
function reviewableOf(proposal: MigrationProposalDto | null) {
  if (proposal === null) {
    return null;
  }
  const { migrationId, plan } = proposal;
  return migrationId === null || plan.isUpToDate ? null : { migrationId, plan };
}

function DetailGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-copy-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** What changes for one component, in groups: where it is used, what is new, what needs a decision. */
function ComponentDetails({ component }: { readonly component: ComponentUpdateView }) {
  const t = useTranslations('release');
  const hasSettings = component.addedFields.length + component.conflictFields.length > 0;

  return (
    <div className="space-y-3">
      <DetailGroup label={t('updates.affectedPages')}>
        {component.pagePaths.map((path) => (
          <Badge key={path} variant="outline">
            <PagePathLabel path={path} />
          </Badge>
        ))}
      </DetailGroup>
      {component.addedFields.length > 0 && (
        <DetailGroup label={t('updates.newSettings')}>
          {component.addedFields.map((field) => (
            <Badge key={field} variant="muted">
              {field}
            </Badge>
          ))}
        </DetailGroup>
      )}
      {component.conflictFields.length > 0 && (
        <DetailGroup label={t('updates.decisionSettings')}>
          {component.conflictFields.map((field) => (
            <Badge key={field} variant="warning">
              {field}
            </Badge>
          ))}
        </DetailGroup>
      )}
      {component.status === 'unresolvable' && (
        <p className="text-sm text-copy">{t('updates.blockedHint')}</p>
      )}
      {component.status !== 'unresolvable' && !hasSettings && (
        <p className="text-sm text-copy-muted">{t('updates.noSettingChange')}</p>
      )}
    </div>
  );
}

const COLUMNS = {
  name: 'sm:col-span-5',
  version: 'sm:col-span-3',
  pages: 'sm:col-span-2',
  status: 'sm:col-span-2',
} as const;

/** The components with something to update, one open at a time or several, each saying what changes. */
function ComponentList({
  components,
  labels,
}: {
  readonly components: readonly ComponentUpdateView[];
  readonly labels: MigrationPanelProps['componentLabels'];
}) {
  const t = useTranslations('release');

  return (
    <div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-12 gap-2 border-b border-border px-4 py-2 pr-10 text-xs font-medium text-copy-muted sm:grid"
      >
        <span className={COLUMNS.name}>{t('updates.columns.component')}</span>
        <span className={COLUMNS.version}>{t('updates.columns.version')}</span>
        <span className={COLUMNS.pages}>{t('updates.columns.affects')}</span>
        <span className={COLUMNS.status}>{t('updates.columns.status')}</span>
      </div>
      <Accordion type="multiple" aria-label={t('updates.columns.component')}>
        {components.map((component) => {
          const version =
            component.toVersion === null
              ? t('updates.noTarget', { from: component.fromVersion })
              : t('updates.versionChange', {
                  from: component.fromVersion,
                  to: component.toVersion,
                });

          return (
            <AccordionItem key={component.type} value={component.type}>
              <AccordionTrigger className="px-4 py-3">
                <div className="grid flex-1 grid-cols-12 items-center gap-2 text-left">
                  <div className={cn('col-span-8', COLUMNS.name)}>
                    <p className="font-medium">{labels[component.type] ?? component.type}</p>
                    <p className="text-xs font-normal text-copy-muted">
                      {t('updates.uses', { count: component.usageCount })}
                      <span className="sm:hidden">
                        {` · ${version} · ${t('table.pagesCount', { count: component.pageCount })}`}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn('hidden font-normal text-copy-muted sm:block', COLUMNS.version)}
                  >
                    {version}
                  </span>
                  <span className={cn('hidden font-normal sm:block', COLUMNS.pages)}>
                    {t('table.pagesCount', { count: component.pageCount })}
                  </span>
                  <span
                    className={cn(
                      'col-span-4 justify-self-end sm:justify-self-start',
                      COLUMNS.status,
                    )}
                  >
                    <Badge variant={STATUS_VARIANTS[component.status]}>
                      {t(`updates.status.${component.status}`)}
                    </Badge>
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ComponentDetails component={component} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/** The state in one line, with the counts as badges: what a person needs to know before opening anything. */
function UpdatesSummary({ updates }: { readonly updates: Updates }) {
  const t = useTranslations('release');
  const ready = updates.available - updates.needReview;

  if (updates.available + updates.unresolvable === 0) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 px-4 py-4 text-sm font-medium text-success"
      >
        <Check className="size-4" aria-hidden="true" />
        {t('updates.upToDateTitle')}
      </p>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
    >
      <p className="mr-1 text-sm font-medium text-copy">
        {updates.available > 0
          ? t('updates.summary', { count: updates.available })
          : t('updates.blockedSummary', { count: updates.unresolvable })}
      </p>
      {ready > 0 && <Badge variant="success">{t('updates.readyCount', { count: ready })}</Badge>}
      {updates.needReview > 0 && (
        <Badge variant="warning">{t('updates.reviewCount', { count: updates.needReview })}</Badge>
      )}
      {updates.available > 0 && updates.unresolvable > 0 && (
        <Badge variant="danger">{t('updates.blockedCount', { count: updates.unresolvable })}</Badge>
      )}
    </div>
  );
}

/**
 * Component updates of the live website, laid out like the release history:
 * how it works, then one panel with the state, the components that have
 * something to update (each opening to say what changes) and a read-only
 * refresh; the review that proposes and records a migration; and the history
 * of earlier updates. Applying writes new drafts; the live site is never
 * touched, the result is reviewed in the builder and published as usual.
 */
export function MigrationPanel({
  websiteId,
  history,
  historyTotal,
  updates,
  componentLabels,
  checkedAt,
  mayRun,
  children,
}: MigrationPanelProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const [proposal, setProposal] = useState<MigrationProposalDto | null>(null);
  const [result, setResult] = useState<ApplyMigrationResultDto | null>(null);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const lastProposed = history.migrations[0]?.createdAt;

  function handleReview() {
    setErrorKey(null);
    setResult(null);
    startTransition(async () => {
      const response = await proposeMigrationAction({ websiteId });
      if (!response.ok) {
        setProposal(null);
        setErrorKey(messageKeyForError(response.error));
        return;
      }
      setProposal(response.data);
    });
  }

  function handleApplied(applied: ApplyMigrationResultDto) {
    setResult(applied);
    // An applied migration is finished; a partial one stays open for another attempt.
    if (applied.status === 'applied') {
      setProposal(null);
    }
  }

  const reviewable = reviewableOf(proposal);
  const canReview = mayRun && updates !== null && updates.available > 0 && proposal === null;

  return (
    <div className="space-y-6" aria-busy={isPending || isRefreshing}>
      <ProcessSteps
        label={t('updates.flow.label')}
        steps={[
          {
            title: t('updates.flow.propose.title'),
            description: t('updates.flow.propose.description'),
          },
          {
            title: t('updates.flow.review.title'),
            description: t('updates.flow.review.description'),
          },
          {
            title: t('updates.flow.publish.title'),
            description: t('updates.flow.publish.description'),
          },
        ]}
      />

      <FieldMessage
        id={`${id}-error`}
        message={errorKey === null ? undefined : t(errorKey)}
        className="rounded-token border border-danger px-4 py-3 text-sm"
      />

      {updates === null ? (
        <p className="rounded-token border border-dashed border-border px-4 py-6 text-center text-sm text-copy-muted">
          {t('migration.panel.needLive')}
        </p>
      ) : (
        <DataPanel
          title={t('updates.panelTitle')}
          description={t('updates.panelDescription')}
          actions={
            <div className="flex items-center gap-2">
              <span role="status" className="text-xs text-copy-muted">
                {isRefreshing
                  ? t('updates.refreshing')
                  : t('updates.checkedAt', {
                      time: format.date(checkedAt, { timeStyle: 'short' }),
                    })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isRefreshing}
                aria-label={t('migration.panel.check')}
                title={t('migration.panel.check')}
                onClick={() => {
                  startRefresh(() => {
                    router.refresh();
                  });
                }}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    'transition-transform duration-500',
                    isRefreshing ? 'animate-spin motion-reduce:animate-none' : 'hover:rotate-90',
                  )}
                />
              </Button>
              {canReview && (
                <Button type="button" size="sm" disabled={isPending} onClick={handleReview}>
                  {isPending && <Spinner aria-hidden="true" />}
                  {t('migration.panel.review')}
                </Button>
              )}
            </div>
          }
        >
          {proposal === null ? (
            <>
              <UpdatesSummary updates={updates} />
              {updates.components.length > 0 && (
                <ComponentList components={updates.components} labels={componentLabels} />
              )}
            </>
          ) : (
            <div className="space-y-4 p-4">
              {reviewable === null ? (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm font-medium text-success"
                >
                  <Check className="size-4" aria-hidden="true" />
                  {t('updates.upToDateTitle')}
                </p>
              ) : (
                <>
                  <PlanCounts counts={reviewable.plan.counts} />
                  <MigrationReview
                    websiteId={websiteId}
                    migrationId={reviewable.migrationId}
                    plan={reviewable.plan}
                    onApplied={handleApplied}
                  />
                </>
              )}
            </div>
          )}
        </DataPanel>
      )}

      {result !== null && <ApplyResult result={result} />}

      <Accordion
        type="single"
        collapsible
        className="rounded-token border border-border bg-surface px-4 shadow-sm"
      >
        <AccordionItem value="history">
          <AccordionTrigger>
            <span>{t('updates.historyTitle', { count: historyTotal })}</span>
            {lastProposed !== undefined && (
              <span className="ml-auto mr-3 text-xs font-normal text-copy-muted">
                {t('updates.lastProposed', { date: format.date(lastProposed) })}
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <MigrationHistoryList history={history} />
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
