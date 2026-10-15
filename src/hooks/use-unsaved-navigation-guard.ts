'use client';

import { useEffect, useRef, useState } from 'react';

/** A region carrying this attribute never navigates (an editor canvas), so the guard leaves its links alone. */
const IGNORE_SELECTOR = '[data-navigation-guard-ignore]';
/** Links, and controls that end the visit by themselves (sign-out) and say so with this attribute. */
const LEAVING_CONTROL_SELECTOR = 'a[href], [data-navigation-guard-leaves]';

export interface UnsavedNavigationGuard {
  /** A link was clicked while `isActive`; the visitor has to decide before it is followed. */
  readonly isPrompting: boolean;
  /** Follow the link that was held back. */
  readonly confirm: () => void;
  /** Stay on the page; nothing about the page changes. */
  readonly cancel: () => void;
}

/** A click that is not a plain press of the primary button: another button, a modifier key or an ignored region. */
function isSpecialClick(event: MouseEvent, control: Element): boolean {
  const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    hasModifier ||
    control.closest(IGNORE_SELECTOR) !== null
  );
}

/** True when the link opens in a new tab, downloads, or stays on this very page. */
function staysHere(anchor: HTMLAnchorElement): boolean {
  if ((anchor.target !== '' && anchor.target !== '_self') || anchor.hasAttribute('download')) {
    return true;
  }
  const destination = new URL(anchor.href, window.location.href);
  return (
    destination.pathname === window.location.pathname &&
    destination.search === window.location.search
  );
}

/** True for a plain click on a control that would take the visitor off this page inside the app. */
function isLeavingClick(event: MouseEvent, control: Element): boolean {
  if (isSpecialClick(event, control)) {
    return false;
  }
  if (!(control instanceof HTMLAnchorElement)) {
    return true;
  }
  // Another origin unloads the page, which `useBeforeUnloadGuard` already covers.
  if (new URL(control.href, window.location.href).origin !== window.location.origin) {
    return false;
  }
  return !staysHere(control);
}

/**
 * Holds back in-app link navigation while `isActive` (for instance, unsaved
 * changes) until the visitor confirms. The App Router has no supported hook
 * for this, so the guard listens for clicks on the document in the capture
 * phase, before the framework's `Link` sees them. A confirmed link is clicked
 * again with the guard stepping aside, so `Link` navigates exactly as it
 * would have. Tab close, reload and external links stay with
 * `useBeforeUnloadGuard`; the browser's back and forward buttons are not
 * covered.
 */
export function useUnsavedNavigationGuard(isActive: boolean): UnsavedNavigationGuard {
  const [isPrompting, setIsPrompting] = useState(false);
  const heldControl = useRef<HTMLElement | null>(null);
  const isReplaying = useRef(false);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    function handleClick(event: MouseEvent): void {
      if (isReplaying.current || !(event.target instanceof Element)) {
        return;
      }
      const control = event.target.closest(LEAVING_CONTROL_SELECTOR);
      if (!(control instanceof HTMLElement) || !isLeavingClick(event, control)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      heldControl.current = control;
      setIsPrompting(true);
    }

    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      heldControl.current = null;
      setIsPrompting(false);
    };
  }, [isActive]);

  return {
    isPrompting,
    confirm() {
      const control = heldControl.current;
      heldControl.current = null;
      setIsPrompting(false);
      // A control that left the page meanwhile has nothing to follow.
      if (!control?.isConnected) {
        return;
      }
      isReplaying.current = true;
      try {
        control.click();
      } finally {
        isReplaying.current = false;
      }
    },
    cancel() {
      heldControl.current = null;
      setIsPrompting(false);
    },
  };
}
