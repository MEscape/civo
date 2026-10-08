import { I18N_CONFIG } from '@i18n';

import { getLocale } from '@i18n/server';

import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import type { AppResultAsync } from '@lib/result';

import type { MailLocale } from '../../domain/ports/auth-mailer.port';
import type { AuthEmailKind } from '../mail/auth-email-templates';

export type { MailLocale };

const mailLogger = logger.withContext({ module: 'auth.mail' });

/**
 * Resolves the mail locale from the active request at send-time.
 *
 * next-intl's `getLocale` natively reads the negotiated locale from the request
 * context on the server. Reading it here — rather than from env — means the
 * email language follows the user's browser/cookie locale automatically with
 * zero extra configuration.
 *
 * Falls back to the i18n default locale when the call is outside a request context
 * (e.g. in a cron job or a background task) or if the locale is unsupported.
 */
export async function resolveMailLocale(): Promise<MailLocale> {
  try {
    const raw = await getLocale();
    if ((I18N_CONFIG.locales as readonly string[]).includes(raw)) {
      return raw;
    }
  } catch {
    // getLocale() throws if called outside a Next.js request context.
  }
  return I18N_CONFIG.defaultLocale;
}

/**
 * Delivers one email and reports failure exactly once, here. It never
 * throws: for password-reset and sign-up the response must be identical
 * whether or not the address exists, and a delivery error that surfaced
 * only for real accounts would reintroduce the enumeration oracle.
 *
 * Only the error is logged. The message itself carries a single-use link.
 */
export async function deliverAuthEmail(
  sending: AppResultAsync<void, InfrastructureAppError>,
  kind: AuthEmailKind,
): Promise<void> {
  const result = await sending;
  if (result.isErr()) {
    mailLogger.error('auth.email_delivery_failed', { kind, err: result.error });
  }
}
