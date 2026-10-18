'use client';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS } from '../messages/message-keys';
import { assessPassword } from '../password/password-strength';

import { RequirementList } from './requirement-list';
import { StrengthMeter } from './strength-meter';

import type { Requirement } from './requirement-list';

export interface PasswordGuidanceProps {
  /** The id the password input points at with `aria-describedby`. */
  readonly id: string;
  readonly password: string;
  /** What the password should not echo: the address, the name. Kept in the browser. */
  readonly personalInputs?: readonly string[] | undefined;
}

/**
 * Beneath a new-password field: how strong the password is, what it must
 * and should be, and one tip. Everything is worked out in the browser as the
 * person types; only the length is checked by the server.
 */
export function PasswordGuidance({ id, password, personalInputs = [] }: PasswordGuidanceProps) {
  const t = useTranslations('auth');
  const assessment = assessPassword(password, personalInputs);
  const isTyped = password.length > 0;

  const requirements: Requirement[] = [
    {
      id: 'length',
      label: t('passwordGuidance.length', MESSAGE_PARAMS),
      isMet: assessment.isLongEnough,
      kind: 'required',
    },
    {
      id: 'common',
      label: t('passwordGuidance.notCommon'),
      isMet: isTyped && assessment.isNotCommon,
      kind: 'recommended',
    },
    ...(assessment.avoidsPersonalInfo === null
      ? []
      : [
          {
            id: 'personal',
            label: t('passwordGuidance.avoidsPersonal'),
            isMet: isTyped && assessment.avoidsPersonalInfo,
            kind: 'recommended' as const,
          },
        ]),
  ];

  return (
    <div id={id} className="space-y-4 rounded-token border border-border bg-canvas p-4">
      <StrengthMeter level={assessment.level} />
      <RequirementList requirements={requirements} />
      <p className="border-t border-border pt-3 text-xs text-copy-muted">
        {t('passwordGuidance.tip')}
      </p>
    </div>
  );
}
