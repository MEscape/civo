import type { ReactNode } from 'react';

import { I18nProvider } from '@components/providers/i18n-provider';

/**
 * The editor's Client Components read `builder` text and, through
 * `useComponentText`, the platform components' labels (`componentPlatform`).
 * Only this subtree receives those namespaces.
 */
export default function BuilderLayout({ children }: { readonly children: ReactNode }) {
  return <I18nProvider namespaces={['builder', 'componentPlatform']}>{children}</I18nProvider>;
}
