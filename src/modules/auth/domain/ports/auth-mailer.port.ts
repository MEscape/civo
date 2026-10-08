import type { Locale } from '@i18n';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

/**
 * The email locale perfectly mirrors the global app locale.
 * If you add a new locale to the app (e.g., 'fr'), TypeScript will now
 * explicitly throw an error in `auth-email-templates.ts` because the `COPY`
 * object will be missing the 'fr' translation block.
 */
export type MailLocale = Locale;

/**
 * A link-bearing message. `url` embeds a single-use token: adapters must
 * never log it, and callers must never persist it.
 */
export interface AuthLinkMessage {
  readonly to: string;
  readonly url: string;
  /** Runtime-resolved from request headers; falls back to i18n default. */
  readonly locale: MailLocale;
}

/**
 * Transactional email the authentication flows need. Copy and locale live
 * in the adapter (i18n.md), not here.
 */
export interface AuthMailer {
  sendVerification(message: AuthLinkMessage): AppResultAsync<void, InfrastructureAppError>;
  sendPasswordReset(message: AuthLinkMessage): AppResultAsync<void, InfrastructureAppError>;
  /**
   * Sent when someone tries to sign up with an address that already has an
   * account. Sign-up answers identically for known and unknown addresses
   * (enumeration protection), so this email is the only way the real owner
   * learns about the attempt.
   */
  sendExistingAccountNotice(message: {
    readonly to: string;
    /** Runtime-resolved from request headers; falls back to i18n default. */
    readonly locale: MailLocale;
  }): AppResultAsync<void, InfrastructureAppError>;
}
