import { CheckboxField } from '@components/shared/checkbox-field';

import { useTranslations } from '@i18n/client';

import { CHANGE_ACTORS } from '../../../application/contracts/booking-constraints';
import { deadlineChoices, deadlinePartsOf, policyReachOf } from '../../drafts/policy-deadlines';
import { CHANGE_ACTOR_MESSAGE_KEYS } from '../../messages/message-keys';
import { OptionSelectField } from '../shared/option-select-field';

import type { PolicyReach } from '../../drafts/policy-deadlines';
import type { PolicyDraft } from '../../drafts/service-draft';

const POLICY_SUMMARY_KEYS = {
  nobody: 'services.policySummary.nobody',
  staffOnly: 'services.policySummary.staffOnly',
  customersOnly: 'services.policySummary.customersOnly',
  customersAndStaff: 'services.policySummary.customersAndStaff',
} as const satisfies Record<PolicyReach, string>;

/** Which change the policy governs; it only picks the words. */
export type PolicyKind = 'cancel' | 'move';

interface PolicyFieldsProps {
  readonly idPrefix: string;
  readonly title: string;
  readonly kind: PolicyKind;
  readonly value: PolicyDraft;
  readonly onChange: (next: PolicyDraft) => void;
}

/**
 * Who may cancel or move a booking, and until when, with the resulting rule
 * said in a sentence. The deadline binds customers only: staff are bound by
 * who is allowed, never by the clock (see `ChangePolicy`).
 */
export function PolicyFields({ idPrefix, title, kind, value, onChange }: PolicyFieldsProps) {
  const t = useTranslations('booking');
  const customersMayChange = value.isAllowed && value.allowedActors.includes('customer');

  const deadlineText = (minutes: number) => {
    if (minutes === 0) {
      return t('services.deadline.atStart');
    }
    const { amount, unit } = deadlinePartsOf(minutes);
    return t('services.deadline.before', {
      duration: t('services.deadline.duration', { amount, unit }),
    });
  };
  const verb = t(kind === 'cancel' ? 'services.policyVerb.cancel' : 'services.policyVerb.move');
  const reach = policyReachOf(value);
  const summary = t(POLICY_SUMMARY_KEYS[reach], {
    verb,
    deadline: deadlineText(value.deadlineMinutes),
  });

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
          {customersMayChange && (
            <OptionSelectField
              id={`${idPrefix}-deadline`}
              label={t('services.policyDeadline')}
              hint={t('services.policyDeadlineHint')}
              value={String(value.deadlineMinutes)}
              options={deadlineChoices(value.deadlineMinutes).map((minutes) => ({
                value: String(minutes),
                label: deadlineText(minutes),
              }))}
              onValueChange={(deadlineMinutes) => {
                onChange({ ...value, deadlineMinutes: Number(deadlineMinutes) });
              }}
            />
          )}
        </div>
      )}
      <p className="rounded-token bg-canvas px-3 py-2 text-xs text-copy-muted">{summary}</p>
    </fieldset>
  );
}
