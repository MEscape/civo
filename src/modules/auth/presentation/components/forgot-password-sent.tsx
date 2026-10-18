'use client';

import { useId, useState, useTransition } from 'react';

import { Button } from '@components/ui/button';
import { ArrowLeft, Check, MailCheck } from '@components/ui/icons';

import { useCountdown } from '@hooks/use-countdown';

import { useTranslations } from '@i18n/client';

import { AUTH_LINK_LIFETIME_SECONDS } from '../../application/contracts/auth-constraints';
import { requestPasswordResetAction } from '../actions/request-password-reset-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { authRoutes } from '../routes';

import { AuthFormAlert } from './auth-form-alert';
import { AuthLink } from './auth-link';
import { AuthPanel } from './auth-panel';

const SECONDS_PER_MINUTE = 60;
const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;
/** The server limits requests too; the wait keeps an impatient person from running into that limit. */
const RESEND_WAIT_SECONDS = 60;

export interface ForgotPasswordSentProps {
  /** Where the link went. */
  readonly email: string;
  /** Back to the form, to correct the address. */
  readonly onChangeAddress: () => void;
}

/**
 * What a person sees after asking for a reset link: where it went, how long
 * it lasts, where to look if it does not come, and a way to ask again after a
 * short wait. The wording is the same whether or not an account exists.
 */
export function ForgotPasswordSent({ email, onChangeAddress }: ForgotPasswordSentProps) {
  const t = useTranslations('auth');
  const id = useId();
  const { secondsLeft, restart } = useCountdown(RESEND_WAIT_SECONDS);
  const [isPending, startTransition] = useTransition();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasResent, setHasResent] = useState(false);

  function handleResend() {
    setErrorCode(null);
    setHasResent(false);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (result.ok) {
        setHasResent(true);
        restart();
        return;
      }
      setErrorCode(result.error.code);
    });
  }

  return (
    <AuthPanel
      icon={MailCheck}
      tone="success"
      title={t('forgotPassword.successTitle')}
      description={t('forgotPassword.success', { minutes: LINK_LIFETIME_MINUTES })}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <div className="space-y-1 rounded-token border border-border bg-canvas px-4 py-3 text-center">
        <p className="text-xs text-copy-muted">{t('forgotPassword.sentTo')}</p>
        <p className="font-medium break-all text-copy">{email}</p>
      </div>

      <p className="text-center text-sm text-copy-muted">{t('forgotPassword.checkSpam')}</p>

      <div className="space-y-3">
        <AuthFormAlert
          id={`${id}-error`}
          message={errorCode === null ? null : t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        />
        {hasResent && (
          <p
            role="status"
            className="flex items-center justify-center gap-1.5 text-sm text-success"
          >
            <Check className="size-4" aria-hidden="true" />
            {t('forgotPassword.resent')}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={isPending || secondsLeft > 0}
            className="sm:flex-1"
            onClick={handleResend}
          >
            {secondsLeft > 0
              ? t('forgotPassword.resendIn', { seconds: secondsLeft })
              : t('forgotPassword.resend')}
          </Button>
          <Button type="button" variant="ghost" className="sm:flex-1" onClick={onChangeAddress}>
            {t('forgotPassword.differentAddress')}
          </Button>
        </div>
      </div>
    </AuthPanel>
  );
}
