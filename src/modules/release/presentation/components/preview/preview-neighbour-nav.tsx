import { ArrowLeft, ArrowRight } from '@components/icons/icons';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { PageRequest } from '@lib/pagination';

import { releaseRoutes } from '../../routes';

import type { ReleaseRefView } from '../../../application/contracts/preview-views';

export interface PreviewNeighbourNavProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Where in the release list the person came from; the neighbours keep it. */
  readonly from: PageRequest;
  readonly older: ReleaseRefView | null;
  readonly newer: ReleaseRefView | null;
}

/** Previous and next release in the history, each a link or, at the end of the history, a disabled button. */
export async function PreviewNeighbourNav({
  locale,
  websiteId,
  from,
  older,
  newer,
}: PreviewNeighbourNavProps) {
  const t = await getTranslations({ locale, namespace: 'release' });
  return (
    <nav aria-label={t('preview.navLabel')} className="flex gap-2">
      {older === null ? (
        <Button variant="outline" size="sm" disabled>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('preview.older')}
        </Button>
      ) : (
        <Link
          href={releaseRoutes.preview(websiteId, older.id, { from })}
          aria-label={t('preview.olderLabel', { number: older.releaseNumber })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('preview.older')}
        </Link>
      )}
      {newer === null ? (
        <Button variant="outline" size="sm" disabled>
          {t('preview.newer')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      ) : (
        <Link
          href={releaseRoutes.preview(websiteId, newer.id, { from })}
          aria-label={t('preview.newerLabel', { number: newer.releaseNumber })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('preview.newer')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
