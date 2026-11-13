import { AlertTriangle, ShieldCheck } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildQueryString } from '@lib/utils';

import { authRoutes } from '../../routes';
import { AuthPanel } from '../shared/auth-panel';

export interface EmailVerificationResultProps {
  /** True when the provider redirected back with an `error` parameter. */
  readonly hasFailed: boolean;
  readonly invitationToken?: string | undefined;
}

/**
 * Outcome of opening the emailed verification link. A Server Component.
 * On failure the fix is to sign in: the provider then sends a fresh link.
 */
export async function EmailVerificationResult({
  hasFailed,
  invitationToken,
}: EmailVerificationResultProps) {
  const t = await getTranslations('auth');

  return (
    <AuthPanel
      icon={hasFailed ? AlertTriangle : ShieldCheck}
      tone={hasFailed ? 'warning' : 'success'}
      title={hasFailed ? t('emailVerification.failureTitle') : t('emailVerification.successTitle')}
      description={hasFailed ? t('emailVerification.failure') : t('emailVerification.success')}
    >
      <Link
        href={authRoutes.signIn(
          invitationToken === undefined
            ? undefined
            : `${authRoutes.acceptInvitation()}${buildQueryString({ token: invitationToken })}`,
        )}
        className={buttonVariants({ size: 'lg', className: 'w-full' })}
      >
        {t('emailVerification.signIn')}
      </Link>
    </AuthPanel>
  );
}
