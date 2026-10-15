import { ChevronRight } from '@components/ui/icons';

export interface ProcessStep {
  readonly title: string;
  readonly description: string;
}

export interface ProcessStepsProps {
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
