import { ProcessSteps } from '@components/shared/process-steps';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { MESSAGE_PARAMS } from '../../messages/message-keys';

/** How an image gets onto the website, shown while the library is still empty. */
export async function MediaFirstSteps({ locale }: { readonly locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'media' });

  return (
    <ProcessSteps
      label={t('library.steps.label')}
      steps={[
        { title: t('library.steps.upload.title'), description: t('library.hint', MESSAGE_PARAMS) },
        {
          title: t('library.steps.place.title'),
          description: t('library.steps.place.description'),
        },
        {
          title: t('library.steps.publish.title'),
          description: t('library.steps.publish.description'),
        },
      ]}
    />
  );
}
