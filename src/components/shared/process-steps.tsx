import type { ReactNode } from 'react';

import { ArrowRight, Check, ChevronRight } from '@components/icons/icons';
import { Alert } from '@components/ui/alert';
import { buttonVariants } from '@components/ui/button';
import { Progress } from '@components/ui/progress';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

import { OverviewPanel, OverviewRow } from './data-panel';

interface ProcessStep {
  readonly title: string;
  readonly description: string;
}

interface ProcessStepsProps {
  readonly label: string;
  readonly steps: readonly ProcessStep[];
}

/** How something goes, in order: numbered steps side by side, one below the other on a narrow screen. */
export function ProcessSteps({ label, steps }: ProcessStepsProps) {
  return (
    <ol
      aria-label={label}
      className="flex flex-col gap-3 rounded-token border border-border bg-surface p-4 sm:flex-row sm:items-start sm:gap-2"
    >
      {steps.map((step, index) => (
        <li key={step.title} className="flex flex-1 items-start gap-2">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-copy">{step.title}</p>
            <p className="text-xs text-copy-muted">{step.description}</p>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight
              className="mt-1 hidden size-4 shrink-0 text-copy-muted sm:block"
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

interface ChecklistStep extends ProcessStep {
  readonly id: string;
  readonly isDone: boolean;
  readonly action?: ReactNode;
}

interface OnboardingChecklistProps {
  readonly title: string;
  readonly progressLabel: string;
  readonly doneLabel: string;
  readonly steps: readonly ChecklistStep[];
}

/** The shared presentation of setup progress; callers own eligibility, completion and actions. */
export function OnboardingChecklist({
  title,
  progressLabel,
  doneLabel,
  steps,
}: OnboardingChecklistProps) {
  const done = steps.filter((step) => step.isDone).length;
  return (
    <OverviewPanel title={title}>
      <OverviewRow className="space-y-2">
        <p className="text-sm text-copy-muted">{progressLabel}</p>
        <Progress value={done} max={steps.length} aria-label={progressLabel} />
      </OverviewRow>
      <ol aria-label={title} className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                step.isDone
                  ? 'border-success-border bg-success-subtle text-success'
                  : 'border-border-strong',
              )}
            >
              {step.isDone && <Check className="size-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn('text-sm font-medium', step.isDone ? 'text-copy-muted' : 'text-copy')}
              >
                {step.title}
              </p>
              {!step.isDone && <p className="text-xs text-copy-muted">{step.description}</p>}
            </div>
            {step.isDone ? (
              <span className="text-xs font-medium text-copy-muted">{doneLabel}</span>
            ) : (
              step.action
            )}
          </li>
        ))}
      </ol>
    </OverviewPanel>
  );
}

interface ReadyForUseNoticeProps {
  /** What is ready and the one thing left, already translated. */
  readonly message: string;
  /** Where that last thing is done: the component waiting for it, or the page list. */
  readonly href: string;
  readonly actionLabel: string;
}

/**
 * Something is set up and the one step left is to use it on a page: a success note with a single
 * button to exactly where that happens. Shared by the screens that end in the page editor.
 */
export function ReadyForUseNotice({ message, href, actionLabel }: ReadyForUseNoticeProps) {
  return (
    <Alert variant="success" role="status">
      {/* One child, so the icon sits in the row instead of the alert's absolute icon slot. */}
      <div className="flex flex-wrap items-center gap-3">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-copy">{message}</p>
        <Link href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {actionLabel}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Alert>
  );
}
