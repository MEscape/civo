'use client';

import { useEffect, useState } from 'react';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

export interface HoldTimerProps {
  /** ISO instant at which the reservation lapses. */
  readonly expiresAt: string;
  readonly onExpired: () => void;
}

const TICK_MS = 1_000;
const SECONDS_PER_MINUTE = 60;
const WARNING_SECONDS = 120;

function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / TICK_MS));
}

/**
 * Shows how long the chosen time stays reserved. The visible countdown is
 * hidden from assistive technology (a ticking live region would be noise);
 * the warning when two minutes remain is announced once.
 */
export function HoldTimer({ expiresAt, onExpired }: HoldTimerProps) {
  const t = useTranslations('booking');
  const [remaining, setRemaining] = useState(() => secondsLeft(expiresAt));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = secondsLeft(expiresAt);
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        onExpired();
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(remaining / SECONDS_PER_MINUTE);
  const seconds = String(remaining % SECONDS_PER_MINUTE).padStart(2, '0');
  const isLow = remaining <= WARNING_SECONDS;

  return (
    <div className="space-y-1">
      <p
        aria-hidden="true"
        className={cn('text-sm', isLow ? 'font-medium text-warning' : 'text-copy-muted')}
      >
        {t('hold.reservedFor', { time: `${minutes}:${seconds}` })}
      </p>
      <p role="status" className="sr-only">
        {isLow ? t('hold.endingSoon') : ''}
      </p>
    </div>
  );
}
