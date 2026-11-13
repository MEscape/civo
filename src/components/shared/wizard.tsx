'use client';

import type { ReactNode } from 'react';

import { Check } from '@components/icons/icons';
import { DataPanelBody, DataPanelFooter } from '@components/shared/data-panel';
import { Button, buttonVariants } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { Progress } from '@components/ui/progress';

import { useStepFocus } from '@hooks/use-step-focus';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export interface WizardStep {
  readonly key: string;
  /** Already translated. */
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* WizardSteps                                                                */
/* -------------------------------------------------------------------------- */

export interface WizardStepsProps {
  readonly steps: readonly WizardStep[];
  readonly currentKey: string;
}

/**
 * Where a person stands in a wizard: the steps in order, the finished ones ticked and joined by a
 * filled line, the current one marked for assistive technology. In a narrow column (a phone, or beside
 * a preview) only the current step's name is drawn; the others stay readable to a screen reader.
 */
export function WizardSteps({ steps, currentKey }: WizardStepsProps) {
  const t = useTranslations('app');
  const currentIndex = steps.findIndex((step) => step.key === currentKey);

  return (
    <nav aria-label={t('wizard.stepsLabel')} className="@container">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 after:mx-2 after:h-0.5 after:flex-1 after:rounded-full last:flex-none last:after:hidden',
                isDone ? 'after:bg-primary' : 'after:bg-border',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors motion-reduce:transition-none',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-primary bg-primary/10 text-primary-copy ring-4 ring-primary/15',
                  !isDone && !isCurrent && 'border-border bg-surface text-copy-muted',
                )}
              >
                {isDone ? <Check className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  isCurrent
                    ? 'truncate font-semibold text-copy'
                    : 'sr-only text-copy-muted @2xl:not-sr-only @2xl:truncate',
                )}
              >
                {step.label}
                {isDone && <span className="sr-only"> ({t('wizard.stepDone')})</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* WizardProgressBar                                                          */
/* -------------------------------------------------------------------------- */

export interface WizardProgressBarProps {
  readonly steps: readonly WizardStep[];
  readonly currentKey: string;
}

/**
 * Where a person stands, in one line and a bar: "Step 3 of 6". For a column too narrow for a row
 * of numbered steps (the public booking sits in a reading-width column). The step's own name is
 * the heading below it, so the name is not repeated here.
 */
export function WizardProgressBar({ steps, currentKey }: WizardProgressBarProps) {
  const t = useTranslations('app');
  const index = steps.findIndex((step) => step.key === currentKey);
  if (index < 0) {
    return null;
  }
  const progress = t('wizard.stepProgress', { current: index + 1, total: steps.length });

  return (
    <div className="space-y-2">
      <p className="text-sm text-copy-muted tabular-nums">{progress}</p>
      <Progress value={index + 1} max={steps.length} aria-label={progress} className="h-1.5" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Wizard                                                                     */
/* -------------------------------------------------------------------------- */

export interface WizardProps {
  readonly steps: readonly WizardStep[];
  /** The step on screen; the caller keeps it in the address (`?step=`), so Back and reload work. */
  readonly currentKey: string;
  /** The step's fields. */
  readonly children: ReactNode;
  /** `WizardActions`, or the caller's own buttons: the primary last. */
  readonly actions: ReactNode;
  /** Where the work stands ("saved in this browser", a refusal), read out as it changes. */
  readonly status?: ReactNode;
}

/**
 * The frame of a multi-step form, shared by every module with one: the step indicator, the current
 * step's heading with how far along the person is, its fields, and the foot with its actions. When
 * the step changes, focus moves to the new step's heading so a keyboard or screen-reader user starts
 * where the new content starts. The page above supplies the `h1`; the step's name is the `h2`.
 */
export function Wizard({ steps, currentKey, children, actions, status }: WizardProps) {
  const t = useTranslations('app');
  const { headingId, headingRef } = useStepFocus(currentKey);

  const index = steps.findIndex((step) => step.key === currentKey);
  const current = steps[index];
  if (current === undefined) {
    return null;
  }
  const progress = t('wizard.stepProgress', { current: index + 1, total: steps.length });

  return (
    <div className="space-y-6">
      <WizardSteps steps={steps} currentKey={currentKey} />
      <Card role="region" aria-labelledby={headingId} className="min-w-0 overflow-hidden">
        <div className="space-y-3 border-b border-border bg-canvas px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-base font-semibold text-copy outline-none"
            >
              {current.label}
            </h2>
            <p className="text-xs text-copy-muted">{progress}</p>
          </div>
          <Progress value={index + 1} max={steps.length} aria-label={progress} className="h-1" />
        </div>
        <DataPanelBody>{children}</DataPanelBody>
        <DataPanelFooter status={status}>{actions}</DataPanelFooter>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* WizardActions                                                              */
/* -------------------------------------------------------------------------- */

export interface WizardActionsProps {
  /** Where "cancel" goes: the list, or the thing's overview. */
  readonly cancelHref: string;
  readonly hasPrevious: boolean;
  /** What "next" says, already translated; absent on the last step, which saves instead. */
  readonly nextLabel: string | undefined;
  readonly saveLabel: string;
  readonly isPending: boolean;
  readonly onBack: () => void;
  readonly onNext: () => void;
}

/** The buttons of a wizard's foot: cancel, back, and on to the next step, or save on the last. */
export function WizardActions({
  cancelHref,
  hasPrevious,
  nextLabel,
  saveLabel,
  isPending,
  onBack,
  onNext,
}: WizardActionsProps) {
  const t = useTranslations('app');

  return (
    <>
      <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
        {t('wizard.cancel')}
      </Link>
      {hasPrevious && (
        <Button type="button" variant="outline" disabled={isPending} onClick={onBack}>
          {t('wizard.back')}
        </Button>
      )}
      {nextLabel === undefined ? (
        <Button type="submit" disabled={isPending}>
          {saveLabel}
        </Button>
      ) : (
        <Button type="button" disabled={isPending} onClick={onNext}>
          {nextLabel}
        </Button>
      )}
    </>
  );
}
