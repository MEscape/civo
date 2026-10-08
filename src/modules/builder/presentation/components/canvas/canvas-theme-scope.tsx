import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

/** The website theme as CSS custom properties, computed by the route from the website module. */
export type ThemeStyle = Readonly<Record<string, string>>;

export interface CanvasThemeScopeProps {
  readonly themeStyle: ThemeStyle;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Applies the theme the same way the public site does: validated tokens as
 * CSS custom properties on a wrapper. The values come from stored data, so
 * inline style is the mechanism here, not a shortcut.
 */
export function CanvasThemeScope({ themeStyle, className, children }: CanvasThemeScopeProps) {
  return (
    <div
      style={{ ...themeStyle, fontFamily: 'var(--civo-font-body)' }}
      className={cn('bg-canvas', className)}
    >
      {children}
    </div>
  );
}
