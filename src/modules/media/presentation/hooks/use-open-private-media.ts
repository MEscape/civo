'use client';

import { useState, useTransition } from 'react';

import { getMediaReadUrlAction } from '../actions/get-media-read-url-action';
import { messageKeyForError } from '../messages/message-keys';

import type { MessageKey } from '../messages/message-keys';

/**
 * Opens a private file through a short-lived address, in a tab that learns nothing about this
 * page. The address is a bearer credential: it is used once and never kept.
 */
export function useOpenPrivateMedia(websiteId: string, assetId: string) {
  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  function handleOpen() {
    setErrorKey(null);
    startTransition(async () => {
      const result = await getMediaReadUrlAction({ websiteId, id: assetId });
      if (result.ok) {
        window.open(result.data.url, '_blank', 'noopener,noreferrer');
      } else {
        setErrorKey(messageKeyForError(result.error));
      }
    });
  }

  return { isPending, errorKey, handleOpen };
}
