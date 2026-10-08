'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

import { I18N_CONFIG } from '@i18n';

import messages from '../i18n/messages/en/app.json';

import './globals.css';

/**
 * Last resort when the locale layout itself fails: it replaces that layout,
 * so neither the locale nor the message provider exists here. It speaks the
 * default locale, whose catalog it reads directly.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const text = messages.routeError;

  return (
    <html lang={I18N_CONFIG.defaultLocale}>
      <body className="min-h-dvh bg-canvas">
        <RouteErrorPanel
          title={text.title}
          description={text.description}
          retryLabel={text.retry}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
