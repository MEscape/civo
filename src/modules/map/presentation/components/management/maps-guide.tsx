import { OnboardingChecklist } from '@components/shared/process-steps';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { mapRoutes } from '../../routes';

import type { MapAwaiting } from '../../dto/map-usage-dto';

interface MapsGuideProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly hasMap: boolean;
  readonly isPlaced: boolean;
  readonly canEdit: boolean;
  /** The first map block still waiting for a map; the place step's button opens it. */
  readonly target: MapAwaiting | undefined;
  readonly builderHref: string;
}

/**
 * From a first map to a map on a page, ticked off from what exists. Only the first step still open
 * gets a button, so there is one next thing to do.
 */
export async function MapsGuide({
  locale,
  websiteId,
  hasMap,
  isPlaced,
  canEdit,
  target,
  builderHref,
}: MapsGuideProps) {
  const t = await getTranslations({ locale, namespace: 'map' });
  const done = [hasMap, isPlaced].filter(Boolean).length;
  return (
    <OnboardingChecklist
      title={t('guide.title')}
      progressLabel={t('guide.progress', { done, total: 2 })}
      doneLabel={t('guide.done')}
      steps={[
        {
          id: 'create',
          isDone: hasMap,
          title: t('guide.create.title'),
          description: t('guide.create.description'),
          action: !hasMap && canEdit && (
            <Link href={mapRoutes.create(websiteId)} className={buttonVariants({ size: 'sm' })}>
              {t('guide.create.action')}
            </Link>
          ),
        },
        {
          id: 'place',
          isDone: isPlaced,
          title: t('guide.place.title'),
          description: t('guide.place.description'),
          action: hasMap && !isPlaced && (
            <Link href={target?.href ?? builderHref} className={buttonVariants({ size: 'sm' })}>
              {target === undefined ? t('guide.openPages') : t('guide.assign')}
            </Link>
          ),
        },
      ]}
    />
  );
}
