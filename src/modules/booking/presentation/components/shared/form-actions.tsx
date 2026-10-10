import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

export interface FormActionsProps {
  readonly isPending: boolean;
  readonly onCancel: () => void;
}

/** Save and cancel at the foot of every configuration form. */
export function FormActions({ isPending, onCancel }: FormActionsProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? t('form.saving') : t('form.save')}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
        {t('form.cancel')}
      </Button>
    </div>
  );
}
