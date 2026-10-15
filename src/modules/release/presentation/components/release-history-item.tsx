'use client';

import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';
import { AlertTriangle, Eye } from '@components/ui/icons';
import { TableCell, TableRow } from '@components/ui/table';

import { Link } from '@i18n';

import { useTranslations, useAppFormatters } from '@i18n/client';

import { cn } from '@lib/utils';

import { CHANGE_KIND_KEYS } from './change-kinds';
import { ReleaseStatusBadge } from './release-status-badge';
import { RestoreReleaseButton } from './restore-release-button';

import type { PageChangeKindView } from '../../application/contracts/release-views';
import type { ReleaseSummaryDto } from '../dto/release-dto';

export interface ReleaseHistoryItemProps {
  readonly websiteId: string;
  readonly release: ReleaseSummaryDto;
  /** What the actor may do; a release that cannot be restored by them shows no restore button. */
  readonly mayRollback: boolean;
  /** Who published it, by actor id; an id without a name is a person who left. */
  readonly authors: Readonly<Record<string, string>> | null;
  /** Where this release's pages can be looked at. */
  readonly previewHref: string;
}

const KINDS: readonly PageChangeKindView[] = ['changed', 'added', 'removed'];

function ChangesCell({ changes }: { readonly changes: ReleaseSummaryDto['changes'] }) {
  const t = useTranslations('release');

  if (changes === null) {
    return (
      <TableCell>
        <span className="text-sm text-copy-muted">{t('table.noDetails')}</span>
      </TableCell>
    );
  }
  const byKind = KINDS.flatMap((kind) => {
    const titles = changes.pageChanges
      .filter((change) => change.kind === kind)
      .map((change) => change.title);
    return titles.length === 0 ? [] : [`${t(CHANGE_KIND_KEYS[kind])}: ${titles.join(', ')}`];
  });

  return (
    <TableCell className="space-y-0.5">
      <p className="text-sm text-copy">
        {changes.pageChangeCount > 0
          ? t('table.pagesCount', { count: changes.pageChangeCount })
          : t('table.settingsChanged')}
      </p>
      {byKind.length > 0 && <p className="text-xs text-copy-muted">{byKind.join(' · ')}</p>}
    </TableCell>
  );
}

/**
 * One release as a table row. Whether it can be restored was decided by the
 * server (`canRollback`); this component only renders that answer. The live
 * release is tinted, so it stands out among the rest at a glance.
 */
export function ReleaseHistoryItem({
  websiteId,
  release,
  mayRollback,
  authors,
  previewHref,
}: ReleaseHistoryItemProps) {
  const t = useTranslations('release');
  const format = useAppFormatters();
  const number = release.releaseNumber;
  const when = release.publishedAt ?? release.createdAt;
  const author = release.publishedBy === null ? undefined : authors?.[release.publishedBy];

  return (
    <TableRow
      aria-current={release.isActive ? 'true' : undefined}
      className={cn(
        'align-top',
        release.isActive && 'bg-success-subtle/40 hover:bg-success-subtle/40',
      )}
    >
      <TableCell className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t('history.releaseNumber', { number })}</span>
          {release.isActive && <Badge variant="success">{t('history.active')}</Badge>}
          {release.status !== 'published' && <ReleaseStatusBadge status={release.status} />}
        </div>
        {release.note !== null && <p className="text-sm text-copy">{release.note}</p>}
        <p className="text-xs text-copy-muted">{format.dateTime(when)}</p>
        {release.publishedBy !== null && authors !== null && (
          <p className="text-xs text-copy-muted">
            {author === undefined
              ? t('history.publishedByFormer')
              : t('history.publishedBy', { name: author })}
          </p>
        )}
        {release.status === 'failed' && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {t('history.buildFailed')}
          </p>
        )}
      </TableCell>

      <ChangesCell changes={release.changes} />

      <TableCell className="text-right">
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Link
            href={previewHref}
            aria-label={t('table.previewLabel', { number })}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {t('table.preview')}
          </Link>
          {mayRollback && release.canRollback && (
            <RestoreReleaseButton
              websiteId={websiteId}
              releaseId={release.id}
              releaseNumber={number}
              publishedAt={when}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
