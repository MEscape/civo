import { CheckboxField } from '@components/shared/checkbox-field';

import { useTranslations } from '@i18n/client';

import { CHANGE_ACTORS } from '../../../application/contracts/booking-constraints';
import { CHANGE_ACTOR_MESSAGE_KEYS } from '../../messages/message-keys';
import { NumberField } from '../shared/number-field';

import type { PolicyDraft } from '../../drafts/service-draft';

interface PolicyFieldsProps {
  readonly idPrefix: string;
  readonly title: string;
  readonly value: PolicyDraft;
  readonly onChange: (next: PolicyDraft) => void;
}

/** Who may cancel or reschedule, and until when. */
export function PolicyFields({ idPrefix, title, value, onChange }: PolicyFieldsProps) {
  const t = useTranslations('booking');
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-copy">{title}</legend>
      <CheckboxField
        id={`${idPrefix}-allowed`}
        label={t('services.policyAllowed')}
        checked={value.isAllowed}
        onChange={(event) => {
          onChange({ ...value, isAllowed: event.target.checked });
        }}
      />
      {value.isAllowed && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberField
            id={`${idPrefix}-deadline`}
            label={t('services.policyDeadline')}
            hint={t('services.policyDeadlineHint')}
            value={value.deadlineMinutes}
            min={0}
            onChange={(deadlineMinutes) => {
              onChange({ ...value, deadlineMinutes: deadlineMinutes ?? 0 });
            }}
          />
          <fieldset className="space-y-1">
            <legend className="text-xs font-medium text-copy-muted">
              {t('services.policyActors')}
            </legend>
            {CHANGE_ACTORS.map((actor) => (
              <CheckboxField
                key={actor}
                id={`${idPrefix}-actor-${actor}`}
                label={t(CHANGE_ACTOR_MESSAGE_KEYS[actor])}
                checked={value.allowedActors.includes(actor)}
                onChange={(event) => {
                  onChange({
                    ...value,
                    allowedActors: event.target.checked
                      ? [...value.allowedActors, actor]
                      : value.allowedActors.filter((existing) => existing !== actor),
                  });
                }}
              />
            ))}
          </fieldset>
        </div>
      )}
    </fieldset>
  );
}
