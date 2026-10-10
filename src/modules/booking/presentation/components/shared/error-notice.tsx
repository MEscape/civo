'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface ErrorNoticeProps {
  /** The stable code the action returned; shown as text in the visitor's language. */
  readonly code: string;
  /** Moves keyboard focus to the notice when it appears, so the problem is not missed. */
  readonly focus?: boolean;
  readonly children?: ReactNode;
}

/** A failed action, explained. Never shows server text: only the code's translation. */
export function ErrorNotice({ code, focus = false, children }: ErrorNoticeProps) {
  const t = useTranslations('booking');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) {
      ref.current?.focus();
    }
  }, [focus, code]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-token focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Alert variant="danger">
        <AlertDescription>{t(messageKeyForCode(code), MESSAGE_PARAMS)}</AlertDescription>
        {children}
      </Alert>
    </div>
  );
}
