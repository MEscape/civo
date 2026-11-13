'use client';

import { Pencil, RefreshCw } from '@components/icons/icons';
import { DataPanel, DataPanelBody } from '@components/shared/data-panel';
import { ClampedText } from '@components/shared/page-parts.client';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useAppFormatters, useNow, useTranslations } from '@i18n/client';

import { useSourceConnection } from '../../hooks/use-source-connection';
import { KIND_MESSAGE_KEYS } from '../../messages/message-keys';

import { ConnectionNotice } from './connection-notice';
import { DataSourceStatusBadge } from './data-source-status-badge';

import type { DataSourceDto } from '../../dto/data-source-dto';

interface SourceConnectionProps {
  readonly source: DataSourceDto;
  /** Whether to offer the test: display only, the use case authorizes on its own. */
  readonly mayTest: boolean;
  /** Where the source's name and connection are edited; absent when the person may not. */
  readonly editHref?: string | undefined;
}

/**
 * Where the source reads from and whether it answered, with the one button that finds out. A source
 * that was just connected is tested as this opens, so the person sees the answer, not a to-do.
 */
export function SourceConnection({ source, mayTest, editHref }: SourceConnectionProps) {
  const t = useTranslations('dataSources');
  const format = useAppFormatters();
  // `useNow` is hydration-safe, unlike `new Date()` in render.
  const now = useNow();
  const { isPending, testMessage, isUntested, handleTestConnection } = useSourceConnection(source);

  return (
    <DataPanel
      title={t('sourceDetail.connectionTitle')}
      description={t('sourceDetail.connectionDescription')}
      actions={
        <>
          {editHref !== undefined && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={editHref}>
                <Pencil className="size-3.5" aria-hidden="true" />
                {t('sourceDetail.edit')}
              </Link>
            </Button>
          )}
          {mayTest && (
            <Button
              type="button"
              variant={isUntested ? 'default' : 'outline'}
              size="sm"
              onClick={handleTestConnection}
              disabled={isPending}
            >
              <RefreshCw
                className={
                  isPending ? 'size-3.5 animate-spin motion-reduce:animate-none' : 'size-3.5'
                }
                aria-hidden="true"
              />
              {isPending ? t('sourceCard.testing') : t('sourceCard.test')}
            </Button>
          )}
        </>
      }
    >
      <DataPanelBody>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-copy-muted">{t('sourceDetail.address')}</dt>
            <dd>
              <ClampedText
                text={source.endpoint ?? t('sourceCard.unknownEndpoint')}
                showMoreLabel={t('text.showMore')}
                showLessLabel={t('text.showLess')}
                className="font-mono text-sm text-copy [overflow-wrap:anywhere]"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-copy-muted">{t('sourceDetail.status')}</dt>
            <dd className="pt-0.5">
              <DataSourceStatusBadge status={source.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-copy-muted">{t('sourceDetail.type')}</dt>
            <dd className="text-sm text-copy">{t(KIND_MESSAGE_KEYS[source.kind])}</dd>
          </div>
          <div>
            <dt className="text-xs text-copy-muted">{t('sourceCard.lastChecked')}</dt>
            <dd className="text-sm text-copy">
              {source.lastCheckedAt
                ? format.relativeTime(source.lastCheckedAt, now)
                : t('sourceCard.never')}
            </dd>
          </div>
        </dl>
        <ConnectionNotice source={source} testMessage={testMessage} />
      </DataPanelBody>
    </DataPanel>
  );
}
