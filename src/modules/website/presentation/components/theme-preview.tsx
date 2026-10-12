'use client';

import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import { ThemeProvider } from './theme-provider';

import type { WebsiteThemeView } from '../../application/contracts/website-views';

export interface ThemePreviewProps {
  readonly theme: WebsiteThemeView;
}

const SAMPLE_BUTTON =
  'px-3 py-2 text-xs sm:text-sm font-medium rounded-token text-center flex-1 min-w-16 truncate';

/**
 * Decorative sample of the theme. It is hidden from assistive technology
 * and uses spans, not buttons, so nothing in it looks or acts focusable.
 */
export function ThemePreview({ theme }: ThemePreviewProps) {
  const t = useTranslations('website');
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <h2 id={headingId} className="mb-6 text-xl font-semibold text-copy">
        {t('themeSettings.previewTitle')}
      </h2>
      <div className="relative flex-1 overflow-hidden rounded-token border border-border bg-surface p-4 sm:p-6">
        <ThemeProvider theme={theme}>
          <div
            aria-hidden="true"
            className="mx-auto max-w-sm space-y-section rounded-token border border-border bg-canvas p-6 shadow-sm"
          >
            <div>
              <p className="mb-2 font-heading text-3xl font-bold text-copy">
                {t('themeSettings.preview.heading')}
              </p>
              <p className="font-body text-base text-copy-muted">
                {t('themeSettings.preview.body')}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 font-body">
              <span className={`${SAMPLE_BUTTON} bg-primary text-primary-foreground`}>
                {t('themeSettings.primary')}
              </span>
              <span className={`${SAMPLE_BUTTON} bg-secondary text-secondary-foreground`}>
                {t('themeSettings.secondary')}
              </span>
              <span className={`${SAMPLE_BUTTON} bg-accent text-accent-foreground`}>
                {t('themeSettings.accent')}
              </span>
            </div>
            <div className="rounded-token border border-border bg-surface p-5">
              <p className="mb-2 font-heading text-xl font-semibold text-copy">
                {t('themeSettings.preview.cardTitle')}
              </p>
              <p className="font-body text-sm text-copy-muted">
                {t('themeSettings.preview.cardBody')}
              </p>
            </div>
          </div>
        </ThemeProvider>
      </div>
    </section>
  );
}
