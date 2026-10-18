'use client';

import { Check } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

export interface PasswordMatchProps {
  readonly id: string;
  readonly password: string;
  readonly confirmation: string;
}

/**
 * Under the repeat field: a tick once both passwords are the same, so a
 * person knows before submitting. A mismatch is the field's own error, shown
 * when they leave it; nothing is drawn while the field is empty.
 */
export function PasswordMatch({ id, password, confirmation }: PasswordMatchProps) {
  const t = useTranslations('auth');
  if (confirmation === '' || confirmation !== password) {
    return null;
  }
  return (
    <p id={id} role="status" className="flex items-center gap-1.5 text-xs text-success">
      <Check className="size-3.5 shrink-0" aria-hidden="true" />
      {t('passwordGuidance.match')}
    </p>
  );
}
