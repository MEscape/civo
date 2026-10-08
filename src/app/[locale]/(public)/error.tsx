'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

import { useTranslations } from '@i18n/client';

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('app');

  return (
    <RouteErrorPanel
      title={t('routeError.title')}
      description={t('routeError.description')}
      retryLabel={t('routeError.retry')}
      onRetry={reset}
    />
  );
}
