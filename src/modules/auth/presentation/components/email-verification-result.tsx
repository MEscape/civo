import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthLink } from './auth-link';
import { StatusNotice } from './status-notice';

export interface EmailVerificationResultProps {
  /** True when the provider redirected back with an `error` parameter. */
  readonly hasFailed: boolean;
}

/**
 * Outcome of opening the emailed verification link. A Server Component.
 * On failure the fix is to sign in: the provider then sends a fresh link.
 */
export async function EmailVerificationResult({ hasFailed }: EmailVerificationResultProps) {
  const t = await getTranslations('auth');

  return (
    <StatusNotice
      title={hasFailed ? t('emailVerification.failureTitle') : t('emailVerification.successTitle')}
    >
      <p>{hasFailed ? t('emailVerification.failure') : t('emailVerification.success')}</p>
      <AuthLink href={authRoutes.signIn()}>{t('emailVerification.signIn')}</AuthLink>
    </StatusNotice>
  );
}
