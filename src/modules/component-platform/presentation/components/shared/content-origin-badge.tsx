import { Badge } from '@components/ui/badge';

import { getTranslations } from '@i18n/server';

import { originMessageKey } from '../../messages/message-keys';

import type { ContentOrigin } from '../../../application/contracts/content-views';

/** `corner` floats over the section's top corner; `inline` sits in the flow, above the content. */
export type ContentOriginPlacement = 'corner' | 'inline';

const PLACEMENT_CLASSES = {
  corner: 'absolute right-4 top-4 z-10',
  inline: 'mb-4 w-fit max-w-full whitespace-normal',
} as const satisfies Record<ContentOriginPlacement, string>;

export interface ContentOriginBadgeProps {
  readonly origin: ContentOrigin;
  readonly placement?: ContentOriginPlacement;
}

/**
 * Tells an editor that the canvas shows placeholder records and why. Live
 * data shows nothing, and a published page never carries sample data, so a
 * visitor never sees this.
 */
export async function ContentOriginBadge({
  origin,
  placement = 'corner',
}: ContentOriginBadgeProps) {
  if (origin.kind !== 'sample') {
    return null;
  }
  const t = await getTranslations('componentPlatform');

  return (
    <Badge variant="warning" className={PLACEMENT_CLASSES[placement]}>
      {t(originMessageKey(origin.cause))}
    </Badge>
  );
}
