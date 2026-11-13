'use client';

import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useClaim } from '../../hooks/use-claim';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface ClaimButtonProps {
  readonly bookingId: string;
  /** The service, so the button names its row ("Termin übernehmen: Reisepass"). */
  readonly name: string;
  /** Where a taken booking now is: the employee's plan. */
  readonly planHref: string;
}

/**
 * "Termin übernehmen" and what the server answered, in a polite live region: taken by you (with the
 * way to the plan), already taken by somebody else ("Bereits vergeben"), or why it failed.
 */
export function ClaimButton({ bookingId, name, planHref }: ClaimButtonProps) {
  const t = useTranslations('booking');
  const { claim, isPending, outcome, refresh } = useClaim(bookingId);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {outcome.kind === 'idle' || outcome.kind === 'failed' ? (
        <Button
          type="button"
          size="lg"
          disabled={isPending}
          aria-label={t('employee.open.claimNamed', { name })}
          onClick={claim}
        >
          {t('employee.open.claim')}
        </Button>
      ) : null}
      {outcome.kind === 'taken' ? (
        <Button type="button" variant="outline" onClick={refresh}>
          {t('employee.open.refresh')}
        </Button>
      ) : null}
      {outcome.kind === 'claimed' ? (
        <Link href={planHref} className={buttonVariants({ variant: 'outline' })}>
          {t('employee.open.toPlan')}
        </Link>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm text-copy-muted">
        {outcome.kind === 'claimed' && t('employee.open.claimed')}
        {outcome.kind === 'taken' && t('employee.open.taken')}
        {outcome.kind === 'failed' && t(messageKeyForCode(outcome.code), MESSAGE_PARAMS)}
      </p>
    </div>
  );
}
