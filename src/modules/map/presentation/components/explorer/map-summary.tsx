'use client';

import { useTranslations } from '@i18n/client';

/** How many locations pass the filters, announced politely as they change. */
export function MapSummary({ shown, total }: { readonly shown: number; readonly total: number }) {
  const t = useTranslations('map');
  return (
    <p role="status" className="text-sm text-copy-muted">
      {shown === 0 ? t('states.noMatches') : t('summary', { shown, total })}
    </p>
  );
}
