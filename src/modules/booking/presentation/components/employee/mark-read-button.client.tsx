'use client';

import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMarkRead } from '../../hooks/use-mark-read';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface MarkReadButtonProps {
  /** One message; `null`: every unread one ("Alle als gelesen markieren"). */
  readonly messageId: string | null;
  /** The button's words, naming its row when it marks one message. */
  readonly label: string;
  /** The name a screen reader hears when the words alone do not say which row ("Gelesen: Termin zugewiesen, 08:02"). */
  readonly accessibleName?: string | undefined;
}

/** Marks messages read; the inbox is read again from the server afterwards, nothing is flipped before. */
export function MarkReadButton({ messageId, label, accessibleName }: MarkReadButtonProps) {
  const t = useTranslations('booking');
  const { markRead, isPending, errorCode } = useMarkRead(messageId);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={messageId === null ? 'outline' : 'ghost'}
        disabled={isPending}
        aria-label={accessibleName}
        onClick={markRead}
      >
        {label}
      </Button>
      {errorCode !== null && (
        <FieldMessage
          id={`mark-read-error-${messageId ?? 'all'}`}
          message={t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        />
      )}
    </div>
  );
}
