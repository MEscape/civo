'use client';

import { useTranslations } from '@i18n/client';

/**
 * Says once, politely, that the region around it is loading; the skeleton
 * blocks themselves are hidden. A Client Component on purpose: loading UI is
 * a Suspense fallback, which must not read the request to find its language.
 */
export function LoadingStatus() {
  const t = useTranslations('app');
  return (
    <p role="status" className="sr-only">
      {t('loading')}
    </p>
  );
}
