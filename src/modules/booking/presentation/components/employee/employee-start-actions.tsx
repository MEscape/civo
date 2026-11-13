import { ArrowRight } from '@components/icons/icons';
import { OverviewPanel } from '@components/shared/data-panel';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';

export interface EmployeeStartActionsProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** How many open bookings suit the employee; `null` when the person may not take any. */
  readonly matching: number | null;
}

/** The ways on from the start page: what each does and, in a line, what is waiting there. */
export async function EmployeeStartActions({
  locale,
  websiteId,
  matching,
}: EmployeeStartActionsProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <OverviewPanel title={t('employee.start.actionsTitle')}>
      <nav aria-label={t('employee.start.actions')} className="contents">
        {matching !== null && (
          <ActionRow
            href={bookingRoutes.meOpen(websiteId)}
            label={t('employee.start.toOpenAction')}
            hint={t('employee.start.toOpenHint', { count: matching })}
          />
        )}
        <ActionRow
          href={bookingRoutes.mePlan(websiteId)}
          label={t('employee.start.toPlanAction')}
          hint={t('employee.start.toPlanHint')}
        />
        {matching !== null && (
          <ActionRow
            href={bookingRoutes.mePreferences(websiteId)}
            label={t('employee.start.toPreferences')}
            hint={t('employee.start.toPreferencesHint')}
          />
        )}
      </nav>
    </OverviewPanel>
  );
}

/** One way on: what it does, a line on what is there, and an arrow. */
function ActionRow({
  href,
  label,
  hint,
}: {
  readonly href: string;
  readonly label: string;
  readonly hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 px-4 py-3 outline-none hover:bg-canvas focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-copy">{label}</span>
        <span className="block text-xs text-copy-muted">{hint}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-copy-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100"
      />
    </Link>
  );
}
