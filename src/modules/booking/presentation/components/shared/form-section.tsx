import type { ReactNode } from 'react';

export interface FormSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** A titled group of related fields inside a long form. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <fieldset className="space-y-4 rounded-token border border-border p-4">
      <legend className="px-1 text-sm font-medium text-copy">{title}</legend>
      {description !== undefined && <p className="text-xs text-copy-muted">{description}</p>}
      {children}
    </fieldset>
  );
}
