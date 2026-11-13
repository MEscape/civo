import { ReadyForUseNotice } from '@components/shared/process-steps';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { MapAwaiting } from '../../dto/map-usage-dto';

interface MapReadyNoticeProps {
  readonly locale: Locale;
  /** The first map block still waiting for a map; absent: the button opens the page list. */
  readonly target: MapAwaiting | undefined;
  readonly builderHref: string;
}

/** The map is saved and no page places it yet: the one step left, straight to where it is done. */
export async function MapReadyNotice({ locale, target, builderHref }: MapReadyNoticeProps) {
  const t = await getTranslations({ locale, namespace: 'map' });
  return target === undefined ? (
    <ReadyForUseNotice
      message={t('guide.ready')}
      href={builderHref}
      actionLabel={t('guide.openPages')}
    />
  ) : (
    <ReadyForUseNotice
      message={t('guide.readyFor', { page: target.page, component: target.label })}
      href={target.href}
      actionLabel={t('guide.assign')}
    />
  );
}
