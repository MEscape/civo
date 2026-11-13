'use client';

import { ReadyForUseNotice as SharedReadyForUseNotice } from '@components/shared/process-steps';

import { useTranslations } from '@i18n/client';

import { dataSourceRoutes } from '../../routes';

import type { ComponentAwaitingData } from '../../dto/dataset-usage-dto';

interface ReadyForUseNoticeProps {
  readonly websiteId: string;
  readonly target: ComponentAwaitingData | undefined;
}

/** Everything is connected and mapped; the one thing left is a component that reads it. */
export function ReadyForUseNotice({ websiteId, target }: ReadyForUseNoticeProps) {
  const t = useTranslations('dataSources');
  return (
    <SharedReadyForUseNotice
      message={
        target === undefined
          ? t('guide.ready')
          : t('guide.readyFor', { page: target.page, component: target.label })
      }
      href={target?.href ?? dataSourceRoutes.builder(websiteId)}
      actionLabel={target === undefined ? t('guide.openPages') : t('guide.assign')}
    />
  );
}
