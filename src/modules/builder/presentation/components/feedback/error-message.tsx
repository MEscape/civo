import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface ErrorMessageProps {
  /** A stable code from the server or the client; never prose. */
  readonly code: string;
  readonly className?: string;
}

export function ErrorMessage({ code, className }: ErrorMessageProps) {
  const t = useTranslations('builder');
  return (
    <p role="alert" className={cn('text-xs text-danger', className)}>
      {t(messageKeyForCode(code), MESSAGE_PARAMS)}
    </p>
  );
}
