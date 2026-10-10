import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import type { FlowStep } from './flow-state';

export interface StepProgressProps {
  readonly steps: readonly FlowStep[];
  readonly current: FlowStep;
}

/** Where the visitor is in the flow. Only the steps that apply to this service are listed. */
export function StepProgress({ steps, current }: StepProgressProps) {
  const t = useTranslations('booking');
  const visible = steps.filter((step): step is Exclude<FlowStep, 'done'> => step !== 'done');
  const position = visible.findIndex((step) => step === current);

  return (
    <nav aria-label={t('progress.label')}>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {visible.map((step, index) => {
          const isCurrent = step === current;
          const isDone = position === -1 || index < position;
          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5',
                isCurrent ? 'font-medium text-copy' : 'text-copy-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border text-xs',
                  isCurrent && 'border-primary bg-primary text-primary-foreground',
                  isDone && !isCurrent && 'border-primary text-primary-copy',
                )}
              >
                {index + 1}
              </span>
              <span>{t(`steps.${step}`)}</span>
              {isDone && !isCurrent && <span className="sr-only">{t('progress.completed')}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
