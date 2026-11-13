import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';

import { BookingLabels } from './booking-labels';
import { PhaseChip } from './phase-chip';
import { PlanMarker } from './plan-marker';

import type { DayPlanItemDto } from '../../dto/employee-dto';
import type { ZonedFormat } from '../../hooks/use-zoned-format';
import type { BookingTranslator } from '../../translation/translator';

/** What a booking of the plan is called when its service is gone. */
export const planItemName = (t: BookingTranslator, item: DayPlanItemDto) =>
  item.labels.serviceName ?? t('employee.unnamedService');

/**
 * The columns of the day: when (with the dot of the timeline), what and where with what the citizen
 * brings, and where it stands with the way to its details.
 */
export function planColumns(
  t: BookingTranslator,
  format: ZonedFormat,
): ReadonlyArray<ResponsiveColumn<DayPlanItemDto>> {
  return [
    {
      id: 'time',
      label: t('employee.plan.columns.time'),
      width: '@xl:w-44',
      cell: ({ booking, phase }) => (
        <span className="flex items-center gap-3">
          <PlanMarker phase={phase} />
          <span className="font-semibold whitespace-nowrap text-copy">
            {format.timeRange(booking.start, booking.end, booking.timeZone)}
          </span>
        </span>
      ),
    },
    {
      id: 'what',
      label: t('employee.plan.columns.what'),
      isTitle: true,
      cell: ({ labels, requiredDocuments }) => (
        <div className="space-y-1">
          <BookingLabels labels={labels} unnamed={t('employee.unnamedService')} />
          {requiredDocuments.length > 0 && (
            <p className="text-sm text-copy">
              {t('employee.plan.bring', { documents: requiredDocuments.join(', ') })}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'phase',
      label: t('employee.plan.columns.state'),
      isAction: true,
      width: '@xl:w-48',
      cell: (item) => (
        <div className="flex flex-col items-start gap-1 @xl:items-end">
          <PhaseChip phase={item.phase}>{t(`employee.phase.${item.phase}`)}</PhaseChip>
          <TableRowDetailsTrigger
            label={t('employee.plan.columns.details')}
            accessibleName={t('employee.plan.details', { name: planItemName(t, item) })}
          />
        </div>
      ),
    },
  ];
}
