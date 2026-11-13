'use client';

import { useEffect, useRef, useState } from 'react';

const FEEDBACK_MS = 2000;

/** Clipboard refusal stays silent; feedback and its timer are owned by the mounted control. */
export function useCopyToClipboard(value: string) {
  const [isCopied, setIsCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setIsCopied(true);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setIsCopied(false);
    }, FEEDBACK_MS);
  }

  return { isCopied, copy };
}
