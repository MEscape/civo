import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@lib/utils';

import { themeToCssVariables } from '../theme/theme-css';

import type { WebsiteThemeView } from '../../application/contracts/website-views';

export interface ThemeProviderProps {
  readonly theme: WebsiteThemeView;
  /** Layout is the caller's concern: the public site passes `min-h-dvh`, the preview does not. */
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Applies a website's theme as CSS custom properties on a wrapping div.
 * This is the only way stored theme data reaches rendering; see
 * `themeToCssVariables` for why that is safe. `data-civo-theme` makes the
 * tokens derived from the theme colours (charts) resolve against this theme
 * rather than the platform default; see `globals.css`. A Server Component.
 */
export function ThemeProvider({ theme, className, children }: ThemeProviderProps) {
  // The values come from stored data, so inline style is the mechanism, not a shortcut.
  // React's CSSProperties has no custom-property keys, hence the single cast.
  const style = {
    ...themeToCssVariables(theme),
    fontFamily: 'var(--civo-font-body)',
  } as CSSProperties;

  return (
    <div data-civo-theme style={style} className={cn('bg-canvas', className)}>
      {children}
    </div>
  );
}
