'use client';

import { Fragment, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Makes a screen start over every time it is come back to. The app keeps the screens a person left
 * mounted but hidden, so that going back is instant; the price is that a form, a wizard or an
 * open dialog is still in the state it was left in, and "create" opens on what was typed the last
 * time. Leaving hides the screen (its layout effects are cleaned up), and that is when this swaps
 * the contents for new ones, so the screen is already fresh when it is shown again. Moving within a
 * screen (the steps of a wizard are addresses of the same page) never hides it, so nothing is lost on the way.
 */
export function FreshOnReturn({ children }: { readonly children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(
    () => () => {
      setVisit((count) => count + 1);
    },
    [],
  );
  return <Fragment key={visit}>{children}</Fragment>;
}
