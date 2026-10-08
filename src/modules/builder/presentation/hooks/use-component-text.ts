import { useMessages } from '@i18n/client';

import { useBuilderSession } from '../components/builder-session-context';
import { createComponentText } from '../properties/component-text';

import type { ComponentText } from '../properties/component-text';

/** The platform components' display text in the current locale. */
export function useComponentText(): ComponentText {
  const messages = useMessages();
  const { catalog } = useBuilderSession();
  return createComponentText(messages, catalog);
}
