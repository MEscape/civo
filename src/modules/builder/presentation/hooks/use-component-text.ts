import { useMessages } from '@i18n/client';

import { createComponentText } from '../properties/component-text';
import { useBuilderSession } from '../state/builder-session-context';

import type { ComponentText } from '../properties/component-text';

/** The platform components' display text in the current locale. */
export function useComponentText(): ComponentText {
  const messages = useMessages();
  const { catalog } = useBuilderSession();
  return createComponentText(messages, catalog);
}
