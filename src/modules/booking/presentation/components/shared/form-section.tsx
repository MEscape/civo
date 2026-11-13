import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

export interface FormSectionProps {
  /** What the fields of the group are about; the group's accessible name. */
  readonly title: string;
  readonly description?: string | undefined;
  readonly children: ReactNode;
  /** Layout from the step that holds it, e.g. to share rows with the section beside it. */
  readonly className?: string | undefined;
  /**
   * A group made of a plain element instead of a `fieldset`: a browser does not let a grid inside a
   * fieldset share its rows with the grid around it, so two columns that must line up row by row
   * use this (`role="group"`, named by the title; assistive technology reads the same).
   */
  readonly isRowGroup?: boolean;
}

/**
 * A titled group of related fields inside a form step ("Deadlines", "Who may cancel"). A `fieldset`
 * with a `legend`, so assistive technology announces the group, not just each field.
 */
export function FormSection({
  title,
  description,
  children,
  className,
  isRowGroup = false,
}: FormSectionProps) {
  const descriptionId = useId();
  const titleId = useId();
  const describedBy = description === undefined ? undefined : descriptionId;
  const heading = isRowGroup ? (
    <p id={titleId} className="text-sm font-semibold text-copy">
      {title}
    </p>
  ) : (
    <legend className="text-sm font-semibold text-copy">{title}</legend>
  );
  const body = (
    <>
      {heading}
      {description !== undefined && (
        <p id={descriptionId} className="text-xs text-copy-muted">
          {description}
        </p>
      )}
      {children}
    </>
  );

  return isRowGroup ? (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      className={cn('space-y-4', className)}
    >
      {body}
    </div>
  ) : (
    <fieldset aria-describedby={describedBy} className={cn('space-y-4', className)}>
      {body}
    </fieldset>
  );
}
