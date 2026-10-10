import { useTranslations } from '@i18n/client';

import { firstCode } from '../components/shared/form-error-summary';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { FormErrors } from '../components/shared/form-error-summary';

/** The translated first error of a field, or `undefined` when the field has none. */
export function useErrorText(errors: FormErrors): (field: string) => string | undefined {
  const t = useTranslations('booking');

  return (field) => {
    const code = firstCode(errors, field);
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };
}
