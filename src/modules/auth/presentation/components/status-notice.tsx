import type { ReactNode } from 'react';

export interface StatusNoticeProps {
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A confirmation that replaces a form once it has done its job. `role=status`
 * announces it politely without stealing focus.
 */
export function StatusNotice({ title, children }: StatusNoticeProps) {
  return (
    <div role="status" className="space-y-3 rounded-token border border-border bg-surface p-6">
      <p className="font-heading text-lg font-semibold text-copy">{title}</p>
      <div className="space-y-3 text-sm text-copy-muted">{children}</div>
    </div>
  );
}
