import { AlertTriangle, Eye } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { publishedByLabel } from '../../authors/published-by-label';
import { CHANGE_KIND_KEYS, CHANGE_KIND_VARIANTS } from '../../changes/change-kinds';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { releaseRoutes } from '../../routes';

import { ReleaseStatusBadge } from './release-status-badge';
import { RestoreReleaseButton } from './restore-release-button';

import type {
  PageChangeKindView,
  ReleaseSummaryView,
} from '../../../application/contracts/release-views';
import type { AppFormatters, ReleaseTranslator } from '../../translation/translator';

interface ReleaseHistoryColumnsInput {
  readonly t: ReleaseTranslator;
  readonly format: AppFormatters;
  readonly websiteId: string;
  /** The page of the list being drawn, so a preview leads back to it. */
  readonly position: { readonly page: number; readonly pageSize: number };
  /** The names of those who published, by actor id; an id without a name is a person who left. */
  readonly authors: Readonly<Record<string, string>> | null;
  /** What the actor may do; a release that cannot be restored by them shows no restore button. */
  readonly mayRollback: boolean;
}

const KINDS: readonly PageChangeKindView[] = ['changed', 'added', 'removed'];

/**
 * The columns of the release list: the release itself, what it changed, and what can be done
 * with it. Whether a release can be restored was decided by the server (`canRollback`); the
 * columns only draw that answer.
 */
export function releaseHistoryColumns({
  t,
  format,
  websiteId,
  position,
  authors,
  mayRollback,
}: ReleaseHistoryColumnsInput): ReadonlyArray<ResponsiveColumn<ReleaseSummaryView>> {
  return [
    {
      id: 'release',
      label: t('table.release'),
      cell: (release) => {
        const when = release.publishedAt ?? release.createdAt;
        const author = publishedByLabel(t, release.publishedBy, authors);
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-sm font-semibold text-copy">
                {t('history.releaseNumber', { number: release.releaseNumber })}
              </span>
              {release.isActive && <Badge variant="success">{t('history.active')}</Badge>}
              {release.status !== 'published' && (
                <ReleaseStatusBadge
                  status={release.status}
                  label={t(STATUS_MESSAGE_KEYS[release.status])}
                />
              )}
            </div>
            {release.note !== null && <p className="text-sm text-copy">{release.note}</p>}
            <p className="text-xs text-copy-muted">
              <time dateTime={when.toISOString()}>{format.dateTime(when)}</time>
              {author !== null && ` · ${author}`}
            </p>
            {release.status === 'failed' && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {t('history.buildFailed')}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'changes',
      label: t('table.changes'),
      cell: ({ changes }) => {
        if (changes === null) {
          return <span className="text-sm text-copy-muted">{t('table.noDetails')}</span>;
        }
        const hidden = changes.pageChangeCount - changes.pageChanges.length;
        const groups = KINDS.flatMap((kind) => {
          const titles = changes.pageChanges
            .filter((change) => change.kind === kind)
            .map((change) => change.title);
          return titles.length === 0 ? [] : [{ kind, titles }];
        });

        return (
          <div className="space-y-1.5">
            <p className="text-sm text-copy">
              {changes.pageChangeCount > 0
                ? t('table.pagesCount', { count: changes.pageChangeCount })
                : changes.mapChangeCount === 0 && t('table.settingsChanged')}
              {changes.mapChangeCount > 0 &&
                `${changes.pageChangeCount > 0 ? ' · ' : ''}${t('table.mapsCount', { count: changes.mapChangeCount })}`}
            </p>
            {groups.length > 0 && (
              <ul className="space-y-1">
                {groups.map(({ kind, titles }) => (
                  <li
                    key={kind}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-copy-muted"
                  >
                    <Badge variant={CHANGE_KIND_VARIANTS[kind]}>{t(CHANGE_KIND_KEYS[kind])}</Badge>
                    {titles.join(', ')}
                  </li>
                ))}
              </ul>
            )}
            {hidden > 0 && (
              <p className="text-xs text-copy-muted">
                {t('publication.morePages', { count: hidden })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      label: t('history.actions'),
      isAction: true,
      cell: (release) => (
        <div className="flex flex-wrap items-start justify-end gap-1">
          <Link
            href={releaseRoutes.preview(websiteId, release.id, { from: position })}
            aria-label={t('table.previewLabel', { number: release.releaseNumber })}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {t('table.preview')}
          </Link>
          {mayRollback && release.canRollback && (
            <RestoreReleaseButton
              websiteId={websiteId}
              releaseId={release.id}
              releaseNumber={release.releaseNumber}
              publishedAt={(release.publishedAt ?? release.createdAt).toISOString()}
              variant="ghost"
            />
          )}
        </div>
      ),
    },
  ];
}
