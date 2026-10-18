'use client';

import { createContext, useContext } from 'react';

/**
 * Where floating layers (the list of a select) open. A modal `<dialog>` makes
 * everything outside it inert, so a layer opened from inside one has to live
 * inside it; `null` is the page body, the ordinary place.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
