import type { ReactNode } from 'react';

import { Check } from '@components/ui/icons';

import { cn } from '@lib/utils';

/** The fields of a form inside a `DataPanel`, with the panel's inner spacing. */
export function FormPanelBody({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn('space-y-6 p-4 sm:p-6', className)}>{children}</div>;
}

export interface FormPanelFooterProps {
  /** Where the form stands (saved, unsaved, refused), read out as it changes. */
  readonly status?: ReactNode;
  /** The form's actions, the submit button last. */
  readonly children: ReactNode;
}

/**
 * The foot of a form inside a `DataPanel`: its state on the left, its actions
 * on the right, on the tinted strip panels use for their header and footer.
 * Every form in a panel ends the same way.
 */
export function FormPanelFooter({ status, children }: FormPanelFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-canvas px-4 py-3">
      <div role="status" className="mr-auto min-w-0 text-sm">
        {status}
      </div>
      {children}
    </div>
  );
}

/** A form's "done" in its footer: ticked, so colour is not the only signal. */
export function FormSuccess({ children }: { readonly children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-success">
      <Check className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
