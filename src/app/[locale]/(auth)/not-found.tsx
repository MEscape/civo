import type { Metadata } from 'next';

import { NotFoundPanel } from '@components/shared/not-found-panel';

import { useTranslations } from '@i18n/client';

/*
 * A 404 is never indexed. Its metadata is static on purpose: a not-found page
 * receives no route params, so a translated title would have to read the
 * request, and that keeps the whole route from being prerendered.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthNotFound() {
  const t = useTranslations('auth');

  return (
    <NotFoundPanel
      title={t('pageNotFound.title')}
      description={t('pageNotFound.description')}
      returnLabel={t('pageNotFound.returnHome')}
    />
  );
}
