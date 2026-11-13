'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { unassignEmployeeAction } from '../../actions/unassign-employee-action';
import { useBookingCommand } from '../../hooks/use-booking-command';
import { useBookingWebsite } from '../../hooks/use-booking-website';

import { AssignButton } from './assign-button.client';

import type { BookingDetailDto } from '../../dto/booking-dto';
import type { UnitLine } from '../../forms/booking-names';

export interface StaffActionsProps {
  readonly bookingId: string;
  /** The employee units of the booking. */
  readonly units: readonly UnitLine[];
  /** What the server lets a manager change now: the domain's rule, so no button offers a refusal. */
  readonly changes: BookingDetailDto['staffChanges'];
  /** Whether to offer any change: display only, every use case authorizes on its own. */
  readonly mayChange: boolean;
  readonly subtitle: string;
  readonly nameOf: (resourceId: string) => string;
  readonly timeZone: string;
}

/**
 * Who serves a booking, one row per place: the person (or "still open") with the one change that fits
 * that place beside it. An open place is filled; an employee can be replaced until the booking begins,
 * and taken off only where the service lets a place be open. The changes sit next to the people they
 * change, so the booking's own actions stay in their menu. A refusal the server still gives is shown.
 */
export function StaffActions({
  bookingId,
  units,
  changes,
  mayChange,
  subtitle,
  nameOf,
  timeZone,
}: StaffActionsProps) {
  const t = useTranslations('booking');
  const websiteId = useBookingWebsite();
  const command = useBookingCommand();
  const shared = { subtitle, nameOf, timeZone };

  return (
    <div className="space-y-1">
      <ul className="divide-y divide-border rounded-token border border-border">
        {units.map(({ resourceId, name, requirementIndex }) => (
          <li
            key={`${String(requirementIndex)}-${resourceId ?? 'open'}`}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span className="min-w-0 text-sm font-medium text-copy [overflow-wrap:anywhere]">
              {resourceId === null || name === null ? (
                <span className="text-copy-muted">{t('bookings.panel.openUnit')}</span>
              ) : (
                name
              )}
            </span>
            {mayChange && (
              <span className="flex flex-wrap gap-1">
                {resourceId === null || name === null ? (
                  <AssignButton
                    {...shared}
                    size="sm"
                    label={t('bookings.actions.assign')}
                    target={{ bookingId, requirementIndex }}
                  />
                ) : (
                  <>
                    {changes.mayReplace && (
                      <AssignButton
                        {...shared}
                        size="sm"
                        variant="ghost"
                        label={t('bookings.actions.replaceOne')}
                        accessibleName={t('bookings.actions.replace', { name })}
                        replacesName={name}
                        target={{ bookingId, requirementIndex, replaces: resourceId }}
                      />
                    )}
                    {changes.mayRemove && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={t('bookings.actions.unassign', { name })}
                        disabled={command.isPending}
                        onClick={() => {
                          command.run(() =>
                            unassignEmployeeAction({ websiteId, bookingId, resourceId }),
                          );
                        }}
                      >
                        {t('bookings.actions.unassignOne')}
                      </Button>
                    )}
                  </>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="text-sm text-copy-muted empty:hidden">
        {command.message}
      </p>
    </div>
  );
}
