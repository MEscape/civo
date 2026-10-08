import { EmptyState } from '@components/layout/layout-primitives';

import { useTranslations } from '@i18n/client';

/** An empty page offers a starting action, not a blank canvas. */
export function CanvasEmptyState() {
  const t = useTranslations('builder');
  return (
    <EmptyState
      variant="outlined"
      className="min-h-96 gap-2"
      title={t('canvas.empty.title')}
      description={t('canvas.empty.hint')}
    />
  );
}
