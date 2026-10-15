'use client';

import { useState, useTransition } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import type { ActionResult } from '@lib/result';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export type DeletableKind = 'location' | 'service' | 'resource';

const KEYS = {
  location: {
    button: 'delete.location.button',
    title: 'delete.location.title',
    description: 'delete.location.description',
  },
  service: {
    button: 'delete.service.button',
    title: 'delete.service.title',
    description: 'delete.service.description',
  },
  resource: {
    button: 'delete.resource.button',
    title: 'delete.resource.title',
    description: 'delete.resource.description',
  },
} as const satisfies Record<DeletableKind, Record<string, string>>;

export interface DeleteEntityButtonProps {
  readonly kind: DeletableKind;
  /** What is being removed, named in the question so it is clear which one. */
  readonly name: string;
  readonly onDelete: () => Promise<ActionResult<null>>;
  /** The thing is gone: the caller leaves the screen that showed it. */
  readonly onDeleted: () => void;
}

/**
 * Removes a location, a service or a resource after asking. Whatever cannot be
 * removed (it has bookings, something still depends on it) is answered with
 * the reason beside the button, in words, and the thing stays as it was.
 */
export function DeleteEntityButton({ kind, name, onDelete, onDeleted }: DeleteEntityButtonProps) {
  const t = useTranslations('booking');
  const [isAsking, setIsAsking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setIsAsking(false);
    startTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        onDeleted();
        return;
      }
      setRefusal(t(messageKeyForCode(result.error.code), MESSAGE_PARAMS));
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        className="text-danger hover:bg-danger-subtle hover:text-danger"
        disabled={isPending}
        onClick={() => {
          setRefusal(null);
          setIsAsking(true);
        }}
      >
        <Icons.trash2 aria-hidden="true" />
        {t(KEYS[kind].button)}
      </Button>
      {refusal !== null && (
        <p role="alert" className="max-w-prose text-sm text-danger">
          {refusal}
        </p>
      )}
      <ConfirmDialog
        open={isAsking}
        title={t(KEYS[kind].title, { name })}
        description={t(KEYS[kind].description)}
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.keep')}
        onConfirm={remove}
        onCancel={() => {
          setIsAsking(false);
        }}
      />
    </div>
  );
}
