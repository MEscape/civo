'use client';

import { useRefreshOnFocus } from '@hooks/use-refresh-on-focus';

/** Mount once in the protected layout. Refresh has no shared state to expose through context. */
export function RefreshOnFocus() {
  useRefreshOnFocus();
  return null;
}
