'use client';

import { RouteErrorPanel } from '@components/page-states/route-error-panel';

import { useTranslations } from '@i18n/client';

export default function ProtectedError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations('app');

  return (
    <RouteErrorPanel
      title={t('routeError.title')}
      description={t('routeError.description')}
      retryLabel={t('routeError.retry')}
      onRetry={retry}
    />
  );
}
