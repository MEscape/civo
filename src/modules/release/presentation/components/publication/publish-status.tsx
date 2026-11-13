import { FieldSuccess } from '@components/shared/field';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { changeCountOf } from '../../changes/change-kinds';

import { PublishButton } from './publish-button';

import type { PublicationStatusView } from '../../../application/contracts/publication-views';

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
  const count = Math.max(1, changeCountOf(draft));

  if (live !== null && !draft.hasChanges) {
    return (
      <div role="status" className="text-sm font-medium whitespace-nowrap">
        <FieldSuccess>
          <span className="lg:hidden">{t('publish.allPublishedShort')}</span>
          <span className="hidden lg:inline">{t('publish.allPublished')}</span>
        </FieldSuccess>
      </div>
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
      shortLabel={t('publish.changesChip', { count })}
      variant="outline"
    />
  ) : (
    <Badge variant="warning">{t('publish.changesChip', { count })}</Badge>
  );
}
