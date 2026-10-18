import type { ComponentType, ReactNode } from 'react';

import { PageHeading } from '@components/layout/layout-primitives';
import type { IconProps } from '@components/ui/icons';

import { cn } from '@lib/utils';

const TONES = {
  default: 'border-border bg-canvas text-primary-copy',
  success: 'border-success-border bg-success-subtle text-success',
  warning: 'border-warning-border bg-warning-subtle text-warning',
  danger: 'border-danger-border bg-danger-subtle text-danger',
} as const;

export interface AuthPanelProps {
  /** What the page is about, as a picture in a round tile above the title. */
  readonly icon: ComponentType<IconProps>;
  /** How the tile reads: the neutral brand look, or the outcome of what the page did. */
  readonly tone?: keyof typeof TONES;
  /** The page's one heading. */
  readonly title: string;
  readonly description?: string;
  /** Beneath the content, on the tinted strip panels use for their foot: the way out ("Back to sign in"). */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The frame of every sign-in style page, built like the panels of the admin:
 * a header with the title, the content, and a tinted footer for the way out.
 * It holds the page's `h1`; a form or a notice goes inside.
 */
export function AuthPanel({
  icon: Icon,
  tone = 'default',
  title,
  description,
  footer,
  children,
}: AuthPanelProps) {
  return (
    <div className="overflow-hidden rounded-token border border-border bg-surface shadow-sm">
      <header className="space-y-4 px-6 pt-8 text-center sm:px-8">
        <span
          className={cn(
            'mx-auto flex size-12 items-center justify-center rounded-full border',
            TONES[tone],
          )}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <PageHeading title={title} description={description} />
      </header>
      <div className="space-y-6 px-6 py-6 sm:px-8">{children}</div>
      {footer !== undefined && (
        <footer className="border-t border-border bg-canvas px-6 py-4 text-center text-sm text-copy-muted sm:px-8">
          {footer}
        </footer>
      )}
    </div>
  );
}
