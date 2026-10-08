import { Container } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

export interface ComponentErrorFallbackProps {
  /** Shown to editors on the canvas only; `null` on published pages. */
  readonly componentType: string | null;
}

export async function ComponentErrorFallback({ componentType }: ComponentErrorFallbackProps) {
  const t = await getTranslations('componentPlatform');

  return (
    <Container className="py-8">
      <div
        role="status"
        className="rounded-token border border-dashed border-border bg-surface px-4 py-3 text-sm text-copy-muted"
      >
        {componentType !== null && <code className="mr-2 font-mono text-xs">{componentType}</code>}
        {t('render.sectionUnavailable')}
      </div>
    </Container>
  );
}
