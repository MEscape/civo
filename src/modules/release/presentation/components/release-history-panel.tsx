'use client';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@components/ui/table';

import { useTranslations } from '@i18n/client';

import { releaseRoutes } from '../routes';

import { ReleaseHistoryItem } from './release-history-item';

import type { ReleaseHistoryDto } from '../dto/release-history-dto';

export interface ReleaseHistoryPanelProps {
  readonly websiteId: string;
  /** Loaded by the Server Component, so the list renders without a client fetch. */
  readonly history: ReleaseHistoryDto;
  /** The page of the list this is, so a preview can lead back to it. */
  readonly page: number;
  /** What the actor may do. Controls they cannot use are not drawn; the server still authorizes. */
  readonly mayRollback: boolean;
  /** The names of those who published, by actor id. */
  readonly authors: Readonly<Record<string, string>> | null;
}

/**
 * One page of a website's releases. The list is server state: after a restore
 * the action invalidates the route instead of this panel mirroring "which
 * release is active". Publishing is not here: it belongs to the publication
 * banner and the bar, where the changes it would publish are shown.
 */
export function ReleaseHistoryPanel({
  websiteId,
  history,
  page,
  mayRollback,
  authors,
}: ReleaseHistoryPanelProps) {
  const t = useTranslations('release');

  if (history.releases.length === 0) {
    return <EmptyState title={t('history.empty')} variant="outlined" className="py-10" />;
  }

  return (
    <div className="space-y-2">
      <DataPanel
        title={t('table.title')}
        footer={t('table.count', { shown: history.releases.length, total: history.total })}
      >
        <Table aria-label={t('history.listLabel')} containerClassName="rounded-none border-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('table.release')}</TableHead>
              <TableHead>{t('table.changes')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('history.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.releases.map((release) => (
              <ReleaseHistoryItem
                key={release.id}
                websiteId={websiteId}
                release={release}
                mayRollback={mayRollback}
                authors={authors}
                previewHref={releaseRoutes.preview(websiteId, release.id, page)}
              />
            ))}
          </TableBody>
        </Table>
      </DataPanel>
      {mayRollback && <p className="text-xs text-copy-muted">{t('history.rollbackNote')}</p>}
    </div>
  );
}
