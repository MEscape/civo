'use client';

import { useTranslations } from '@i18n/client';

import { RouteErrorPanel } from '@/components/page-states/route-error-panel';

export default function AuthError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('auth');

  return (
    <RouteErrorPanel
      title={t('pageError.title')}
      description={t('pageError.description')}
      retryLabel={t('pageError.retry')}
      onRetry={retry}
    />
  );
}
