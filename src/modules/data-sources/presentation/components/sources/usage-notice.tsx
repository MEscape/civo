import { Alert } from '@components/ui/alert';

import type { DataSourcesTranslator } from '../../translation/translator';

export interface UsageNoticeProps {
  readonly t: DataSourcesTranslator;
  /** How far the read of where datasets are used got; nothing is shown when it is complete. */
  readonly state: 'complete' | 'incomplete' | 'unavailable';
}

/** Says when "unused" cannot be trusted: an incomplete or failed read never describes a dataset as unused. */
export function UsageNotice({ t, state }: UsageNoticeProps) {
  if (state === 'complete') {
    return null;
  }
  return (
    <Alert variant="warning" role="status">
      {state === 'incomplete' ? t('panel.usageTruncated') : t('panel.usageUnavailable')}
    </Alert>
  );
}
