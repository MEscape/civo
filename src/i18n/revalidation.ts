import 'server-only';

import { revalidatePath } from 'next/cache';

import { getPathname, I18N_CONFIG } from './config';

/**
 * Concrete page addresses are locale-prefixed; invalidate each configured translation. `layout`
 * also invalidates every page below the address.
 */
export function revalidateLocalizedPath(pathname: string, type?: 'layout' | 'page'): void {
  for (const locale of I18N_CONFIG.locales) {
    const localized = getPathname({ locale, href: pathname });
    if (type === undefined) {
      revalidatePath(localized);
    } else {
      revalidatePath(localized, type);
    }
  }
}
