'use client';

import { Trash2 } from '@components/icons/icons';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { holidayOf } from '../../forms/exceptions';
import { formatRanges } from '../../forms/week/time';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { EXCEPTION_KIND_MESSAGE_KEYS, HOLIDAY_MESSAGE_KEYS } from '../../messages/message-keys';

import type { ExceptionInputDto } from '../../dto/location-dto';
import type { ExceptionRow } from '../../forms/exceptions';

export interface ExceptionsTableProps {
  readonly rows: readonly ExceptionRow[];
  /** The first refusal of the server's rules for an exception, by its place in the list; shown on its row. */
  readonly messageOf: (index: number) => string | undefined;
  readonly empty: string;
  readonly onEdit: (index: number) => void;
  readonly onRemove: (index: number) => void;
  /** `periods`: only the days and the way to change them (blocked periods, absences: all closed, no hours). */
  readonly variant?: 'full' | 'periods';
}

/** The days an exception covers as one phrase: a day, or a span of days. */
function useWhen() {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  return ({ from, to }: ExceptionInputDto) => {
    if (from === '') {
      return t('exceptions.newRow');
    }
    return from === to || to === ''
      ? zoned.calendarDate(from)
      : t('exceptions.range', { from: zoned.calendarDate(from), to: zoned.calendarDate(to) });
  };
}

/** The exceptions of the list as the app's responsive table: when, what kind, which hours, and the way to change or remove one. */
export function ExceptionsTable({
  rows,
  messageOf,
  empty,
  onEdit,
  onRemove,
  variant = 'full',
}: ExceptionsTableProps) {
  const t = useTranslations('booking');
  const when = useWhen();
  const byIndex = new Map(rows.map(({ exception, index }) => [exception, index]));
  const indexOf = (exception: ExceptionInputDto) => byIndex.get(exception) ?? -1;

  return (
    <ResponsiveTable
      label={t('exceptions.listLabel')}
      rows={rows.map(({ exception }) => exception)}
      rowKey={indexOf}
      density="standard"
      state={{
        kind: 'ready',
        empty: <p className="p-6 text-center text-sm text-copy-muted">{empty}</p>,
      }}
      columns={[
        {
          id: 'when',
          label: t('exceptions.columns.when'),
          isTitle: true,
          width: '@3xl:w-3/8',
          cell: (exception) => {
            const holiday = holidayOf(exception);
            const message = messageOf(indexOf(exception));
            return (
              <div className="space-y-0.5">
                <p className="font-medium text-copy">{when(exception)}</p>
                {holiday !== undefined && (
                  <p className="text-xs text-copy-muted">
                    {t('exceptions.holiday', { name: t(HOLIDAY_MESSAGE_KEYS[holiday]) })}
                  </p>
                )}
                {message !== undefined && <p className="text-xs text-danger">{message}</p>}
              </div>
            );
          },
        },
        ...(variant === 'full'
          ? [
              {
                id: 'kind',
                label: t('exceptions.columns.kind'),
                cell: (exception: ExceptionInputDto) =>
                  t(EXCEPTION_KIND_MESSAGE_KEYS[exception.kind]),
              },
              {
                id: 'hours',
                label: t('exceptions.columns.hours'),
                cell: ({ kind, day }: ExceptionInputDto) =>
                  kind === 'closed' || day === undefined || day.intervals.length === 0
                    ? '–'
                    : [
                        formatRanges(day.intervals),
                        ...(day.breaks.length === 0
                          ? []
                          : [t('hours.breakWord', { breaks: formatRanges(day.breaks) })]),
                      ].join(' · '),
              },
            ]
          : []),
        {
          id: 'actions',
          label: t('exceptions.columns.actions'),
          isAction: true,
          cell: (exception) => (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t('exceptions.details', { title: when(exception) })}
                onClick={() => {
                  onEdit(indexOf(exception));
                }}
              >
                {t('overview.edit')}
              </Button>
              <Button
                type="button"
                variant="destructive-ghost"
                size="icon-sm"
                aria-label={`${t('exceptions.remove')}: ${when(exception)}`}
                onClick={() => {
                  onRemove(indexOf(exception));
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}
