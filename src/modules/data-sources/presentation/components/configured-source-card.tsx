'use client';

import { useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { useRouter } from '@i18n';

import { useNow, useTranslations, useAppFormatters } from '@i18n/client';

import { deleteDataSourceAction } from '../actions/delete-data-source-action';
import { testDataSourceConnectionAction } from '../actions/test-data-source-connection-action';
import { KIND_MESSAGE_KEYS, MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import { DataSourceStatusBadge } from './data-source-status-badge';
import { DatasetManagementPanel } from './dataset-management-panel';

import type { DataSourceDto } from '../dto/data-source-dto';

export interface ConfiguredSourceCardProps {
  readonly source: DataSourceDto;
}

type TestMessage =
  { readonly kind: 'healthy' } | { readonly kind: 'failed'; readonly code: string };

export function ConfiguredSourceCard({ source }: ConfiguredSourceCardProps) {
  const t = useTranslations('dataSources');

  const format = useAppFormatters();
  // `useNow` is hydration-safe, unlike `new Date()` in render.
  const now = useNow();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);
  const [deleteErrorCode, setDeleteErrorCode] = useState<string | undefined>(undefined);

  function handleTestConnection() {
    setTestMessage(null);
    startTransition(async () => {
      const result = await testDataSourceConnectionAction(source.id);
      if (!result.ok) {
        setTestMessage({ kind: 'failed', code: result.error.code });
      } else {
        const { outcome } = result.data;
        setTestMessage(
          outcome.isHealthy ? { kind: 'healthy' } : { kind: 'failed', code: outcome.errorCode },
        );
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(t('sourceCard.confirmDelete'))) {
      return;
    }
    setDeleteErrorCode(undefined);

    startTransition(async () => {
      const result = await deleteDataSourceAction(source.id);
      if (!result.ok) {
        setDeleteErrorCode(result.error.code);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle>{source.name}</CardTitle>
          <CardDescription className="mt-1">
            {source.endpoint ?? t('sourceCard.unknownEndpoint')}
          </CardDescription>
        </div>
        <DataSourceStatusBadge status={source.status} />
      </CardHeader>
      <CardContent className="space-y-6 border-t pt-4">
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-copy-muted">{t('sourceCard.kind')}</dt>
              <dd className="text-copy">{t(KIND_MESSAGE_KEYS[source.kind])}</dd>
            </div>
            <div>
              <dt className="text-copy-muted">{t('sourceCard.lastChecked')}</dt>
              <dd className="text-copy">
                {source.lastCheckedAt
                  ? format.relativeTime(source.lastCheckedAt, now)
                  : t('sourceCard.never')}
              </dd>
            </div>
          </dl>

          {source.status === 'ERROR' && source.lastErrorCode && (
            <div className="rounded-token border border-danger/20 bg-danger/10 px-3 py-2">
              <FieldMessage
                id={`${source.id}-last-error`}
                message={t(messageKeyForCode(source.lastErrorCode), MESSAGE_PARAMS)}
                className="text-sm text-danger"
              />
            </div>
          )}

          {testMessage?.kind === 'healthy' && (
            <p role="status" className="text-sm text-copy">
              {t('sourceCard.testHealthy')}
            </p>
          )}
          {testMessage?.kind === 'failed' && (
            <FieldMessage
              id={`${source.id}-test-error`}
              message={t(messageKeyForCode(testMessage.code), MESSAGE_PARAMS)}
              className="text-sm"
            />
          )}
          <FieldMessage
            id={`${source.id}-delete-error`}
            message={
              deleteErrorCode ? t(messageKeyForCode(deleteErrorCode), MESSAGE_PARAMS) : undefined
            }
            className="text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isPending}
            >
              {isPending ? t('sourceCard.testing') : t('sourceCard.test')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              {t('sourceCard.remove')}
            </Button>
          </div>
        </div>

        <DatasetManagementPanel dataSource={source} />
      </CardContent>
    </Card>
  );
}
