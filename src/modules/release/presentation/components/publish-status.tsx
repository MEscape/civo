import { Badge } from '@components/ui/badge';
import { Check } from '@components/ui/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { PublishButton } from './publish-button';

import type { PublicationStatusView } from '../../application/contracts/release-views';

export interface PublishStatusProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly status: PublicationStatusView;
  readonly mayPublish: boolean;
}

/**
 * The website bar's answer to "is everything live?", on every page of the
 * website: a tick when it is, and when it is not, the number of changes
 * waiting with the way to publish them.
 */
export async function PublishStatus({ locale, websiteId, status, mayPublish }: PublishStatusProps) {
  const t = await getTranslations({ locale, namespace: 'release' });
  const { live, draft } = status;
  const count = Math.max(1, draft.pageChangeCount);

  if (live !== null && !draft.hasChanges) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
        <Check className="size-4" aria-hidden="true" />
        {t('publish.allPublished')}
      </p>
    );
  }
  return mayPublish ? (
    <PublishButton
      websiteId={websiteId}
      draft={draft}
      nextNumber={status.nextReleaseNumber}
      isFirst={live === null}
      disabled={draft.blockedPageCount > 0}
      label={t('publish.chipLabel', { count })}
      variant="outline"
    />
  ) : (
    <Badge variant="warning">{t('publish.changesChip', { count })}</Badge>
  );
}
