import { Check } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { Progress } from '@components/ui/progress';

import type { DayPlanDto } from '../../dto/employee-dto';
import type { ZonedFormat } from '../../hooks/use-zoned-format';
import type { BookingTranslator } from '../../translation/translator';

export interface DayPlanAsideProps {
  readonly t: BookingTranslator;
  readonly format: ZonedFormat;
  readonly plan: DayPlanDto;
  readonly done: number;
}

/**
 * The column beside the day: how far it is (a day with nothing in it is a day that is done, so its bar
 * is full, not empty), when the person works and pauses, and the tips.
 */
export function DayPlanAside({ t, format, plan, done }: DayPlanAsideProps) {
  const total = plan.items.length;
  const { workday } = plan;
  return (
    <aside className="space-y-6" aria-label={t('employee.plan.asideLabel')}>
      <DataPanel title={t('employee.plan.progress.title')}>
        <div className="space-y-3 p-4">
          <Progress
            value={total === 0 ? 1 : done}
            max={Math.max(total, 1)}
            aria-label={t('employee.plan.progress.title')}
          />
          <p className="flex items-center gap-2 text-sm text-copy-muted">
            {total === 0 || done === total ? (
              <Check aria-hidden="true" className="size-4 text-success" />
            ) : null}
            {t('employee.plan.progress.done', { done, total })}
          </p>
        </div>
      </DataPanel>
      <DataPanel title={t('employee.plan.workday.title')}>
        <div className="space-y-1 p-4 text-sm">
          {workday === null ? (
            <p className="text-copy-muted">{t('employee.plan.workday.dayOff')}</p>
          ) : (
            <>
              <p className="font-medium text-copy">
                {t('employee.plan.workday.works', {
                  hours: format.timeRange(workday.start, workday.end, plan.timeZone),
                })}
              </p>
              {workday.breaks.map((pause) => (
                <p key={pause.start} className="text-copy-muted">
                  {t('employee.plan.workday.breakAt', {
                    hours: format.timeRange(pause.start, pause.end, plan.timeZone),
                  })}
                </p>
              ))}
            </>
          )}
        </div>
      </DataPanel>
      <DataPanel title={t('employee.plan.tips.title')}>
        <ul className="list-disc space-y-1 p-4 ps-9 text-sm text-copy-muted">
          <li>{t('employee.plan.tips.details')}</li>
          <li>{t('employee.plan.tips.handBack')}</li>
          <li>{t('employee.plan.tips.messages')}</li>
        </ul>
      </DataPanel>
    </aside>
  );
}
