'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@components/ui/button';
import { Check, Copy } from '@components/ui/icons';

export interface CopyButtonProps {
  /** What goes to the clipboard. */
  readonly value: string;
  readonly label: string;
  /** Said for a moment after copying; announced to assistive technology. */
  readonly copiedLabel: string;
}

const FEEDBACK_MS = 2000;

/**
 * A small button that copies a value and says so. Where the clipboard is not
 * available (an insecure origin, a refused permission) it stays quiet rather
 * than claiming something it did not do.
 */
export function CopyButton({ value, label, copiedLabel }: CopyButtonProps) {
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

  async function handleCopy() {
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

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={label}
        onClick={() => {
          void handleCopy();
        }}
      >
        {isCopied ? (
          <Check className="text-success" aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </Button>
      <span role="status" className="sr-only">
        {isCopied ? copiedLabel : ''}
      </span>
    </>
  );
}
