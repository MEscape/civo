'use client';

import { useEffect, useRef } from 'react';

import { useRouter } from '@i18n';

/** Window focus and visibility commonly fire together; coalesce their reads. */
const MIN_INTERVAL_MS = 1_000;

/**
 * Re-reads the page when its tab becomes visible or its window gains focus, so a screen left open
 * while someone edited, published or booked elsewhere is current when they
 * return. The server stays the source of truth: this only asks it again.
 */
export function useRefreshOnFocus() {
  const router = useRouter();
  const lastRead = useRef(0);

  useEffect(() => {
    // The page was just read.
    lastRead.current = Date.now();
    function handleVisibility() {
      if (
        document.visibilityState !== 'visible' ||
        Date.now() - lastRead.current < MIN_INTERVAL_MS
      ) {
        return;
      }
      lastRead.current = Date.now();
      router.refresh();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [router]);
}
