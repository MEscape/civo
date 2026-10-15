import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

export interface FormActionsProps {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  /** What takes the entry away (a `DeleteEntityButton`); kept apart from save so the two are not confused. */
  readonly removal?: ReactNode;
}

/** Save and cancel at the foot of every configuration form. */
export function FormActions({ isPending, onCancel, removal }: FormActionsProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? t('form.saving') : t('form.save')}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
        {t('form.cancel')}
      </Button>
      {removal !== undefined && <div className="ml-auto">{removal}</div>}
    </div>
  );
}
