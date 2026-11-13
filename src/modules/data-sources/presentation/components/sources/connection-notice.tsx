'use client';

import { Info } from '@components/icons/icons';
import { FieldMessage, FieldSuccess } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { connectionNoticeId } from './connection-notice-id';

import type { DataSourceDto } from '../../dto/data-source-dto';
import type { TestMessage } from '../../hooks/use-source-connection';

/** What is known about the connection: the fresh test result, else the stored error, else a nudge to test. */
export function ConnectionNotice({
  source,
  testMessage,
}: {
  readonly source: DataSourceDto;
  readonly testMessage: TestMessage | null;
}) {
  const t = useTranslations('dataSources');
  const errorBox = 'rounded-token border border-danger-border bg-danger-subtle px-3 py-2';

  let notice = null;
  if (testMessage?.kind === 'healthy') {
    notice = (
      <div className="text-sm">
        <FieldSuccess>{t('sourceCard.testHealthy')}</FieldSuccess>
      </div>
    );
  } else if (testMessage?.kind === 'failed') {
    notice = (
      <div className={errorBox}>
        <FieldMessage
          id={`${source.id}-test-error`}
          message={t(messageKeyForCode(testMessage.code), MESSAGE_PARAMS)}
          className="text-sm text-danger"
        />
      </div>
    );
  } else if (source.status === 'ERROR' && source.lastErrorCode) {
    notice = (
      <div className={errorBox}>
        <FieldMessage
          id={`${source.id}-last-error`}
          message={t(messageKeyForCode(source.lastErrorCode), MESSAGE_PARAMS)}
          className="text-sm text-danger"
        />
        <p className="mt-1 text-xs text-copy">
          {source.datasets.length > 0
            ? t('sourceCard.failedWithDatasets')
            : t('sourceCard.failedHint')}
        </p>
      </div>
    );
  } else if (source.status === 'UNKNOWN') {
    notice = (
      <p className="flex gap-2 text-sm text-copy-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
        {t('sourceCard.untestedHint')}
      </p>
    );
  }

  return (
    <div id={connectionNoticeId(source.id)} aria-live="polite">
      {notice}
    </div>
  );
}
