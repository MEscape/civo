import { UserPlus } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { BookingEmptyState } from '../shared/booking-empty-state';

export interface TeamEmptyProps {
  readonly locale: Locale;
  /** The address of the list without filters. */
  readonly resetHref: string;
  /** A search or a filter narrowed the list: it is the filter that found nothing, not the location. */
  readonly isFiltered: boolean;
  /** Members with the role "Employee" who have no calendar yet. */
  readonly candidateCount: number;
  /** Where members and their roles are managed, for someone who may open it. */
  readonly usersHref?: string | undefined;
}

/** The three kinds of "nothing": no result for the filters, nobody yet but someone could be added, nobody yet and nobody to add. */
export async function TeamEmpty({
  locale,
  resetHref,
  isFiltered,
  candidateCount,
  usersHref,
}: TeamEmptyProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  if (isFiltered) {
    return (
      <BookingEmptyState
        icon={<UserPlus aria-hidden="true" />}
        title={t('team.list.filteredTitle')}
        description={t('team.list.filteredDescription')}
        action={
          <Link href={resetHref} className={buttonVariants({ variant: 'outline' })}>
            {t('team.filters.resetSelection')}
          </Link>
        }
      />
    );
  }
  return (
    <BookingEmptyState
      icon={<UserPlus aria-hidden="true" />}
      title={t('team.list.emptyTitle')}
      description={
        candidateCount > 0
          ? t('team.list.emptyWithCandidates', { count: candidateCount })
          : t('team.list.emptyDescription')
      }
      action={
        candidateCount === 0 && usersHref !== undefined ? (
          <Link href={usersHref} className={buttonVariants({ variant: 'outline' })}>
            {t('team.list.emptyAction')}
          </Link>
        ) : undefined
      }
    />
  );
}
