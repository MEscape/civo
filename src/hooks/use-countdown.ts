'use client';

import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;

/**
 * A countdown in whole seconds, for a button that may be pressed again only
 * after a wait ("send again in 42s"). `restart` starts it over; it stops at 0.
 */
export function useCountdown(initialSeconds: number): {
  readonly secondsLeft: number;
  readonly restart: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, TICK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [secondsLeft]);

  const restart = useCallback(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  return { secondsLeft, restart };
}
