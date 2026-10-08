import { Container } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

export interface UnknownComponentProps {
  readonly type: string;
}

/**
 * Stands in for a node whose type is not registered (an old page that
 * references a component that was renamed or removed). Editors see it on
 * the canvas; nothing is ever imported or run based on the type string.
 */
export async function UnknownComponent({ type }: UnknownComponentProps) {
  const t = await getTranslations('componentPlatform');

  return (
    <Container className="py-8">
      <div className="rounded-token border border-dashed border-secondary px-4 py-3 text-sm text-secondary-copy">
        {t('render.unknownComponent')} <code className="font-mono">{type}</code>
      </div>
    </Container>
  );
}
