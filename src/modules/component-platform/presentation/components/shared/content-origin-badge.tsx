import { Badge } from '@components/ui/badge';

import { getTranslations } from '@i18n/server';

import { originMessageKey } from '../../messages/message-keys';

import type { ContentOrigin } from '../../../application/contracts/content-views';

export interface ContentOriginBadgeProps {
  readonly origin: ContentOrigin;
}

/**
 * Tells an editor that the canvas shows placeholder records and why. Live
 * data shows nothing, and a published page never carries sample data, so a
 * visitor never sees this.
 */
export async function ContentOriginBadge({ origin }: ContentOriginBadgeProps) {
  if (origin.kind !== 'sample') {
    return null;
  }
  const t = await getTranslations('componentPlatform');

  return (
    <Badge variant="warning" className="absolute right-4 top-4 z-10">
      {t(originMessageKey(origin.cause))}
    </Badge>
  );
}
