'use client';

import { useId, useRef, useState } from 'react';

import { useDismiss } from '@hooks/use-dismiss';

/**
 * A button and the panel it opens (the disclosure pattern, not an ARIA menu). The panel closes on
 * Escape (focus goes back to the button), on a press outside and when `close` is called.
 */
export function useDisclosureMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismiss(isOpen, rootRef, (reason) => {
    setIsOpen(false);
    if (reason === 'escape') {
      buttonRef.current?.focus();
    }
  });

  return {
    isOpen,
    panelId,
    rootRef,
    buttonRef,
    toggle: () => {
      setIsOpen((open) => !open);
    },
    close: () => {
      setIsOpen(false);
    },
  };
}
