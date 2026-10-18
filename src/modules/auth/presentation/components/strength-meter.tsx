'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { STRENGTH } from '../password/password-strength';

import type { StrengthLevel } from '../password/password-strength';

const LEVEL_KEYS = {
  1: 'passwordGuidance.strength.weak',
  2: 'passwordGuidance.strength.fair',
  3: 'passwordGuidance.strength.good',
  4: 'passwordGuidance.strength.strong',
} as const;

const SEGMENTS = [STRENGTH.weak, STRENGTH.fair, STRENGTH.good, STRENGTH.strong] as const;

/** The colour of the filled segments: status colours, so a website's theme cannot change what "weak" looks like. */
const FILL = {
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-success',
  4: 'bg-success',
} as const;

const TEXT = {
  1: 'text-danger',
  2: 'text-warning',
  3: 'text-success',
  4: 'text-success',
} as const;

export interface StrengthMeterProps {
  readonly level: StrengthLevel;
}

/**
 * Four segments and a word. The word is the live region: it changes only when
 * the level does, so a screen reader hears "Strength: Good" once, not on every
 * keystroke. The segments are decoration; colour is never the only signal.
 */
export function StrengthMeter({ level }: StrengthMeterProps) {
  const t = useTranslations('auth');

  return (
    <div className="space-y-1.5">
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {SEGMENTS.map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1.5 rounded-full transition-colors motion-reduce:transition-none',
              level >= segment && level !== STRENGTH.none ? FILL[level] : 'bg-border',
            )}
          />
        ))}
      </div>
      <p
        role="status"
        className={cn('text-xs font-medium', level === 0 ? 'text-copy-muted' : TEXT[level])}
      >
        {level === 0
          ? t('passwordGuidance.empty')
          : t('passwordGuidance.strengthLabel', { level: t(LEVEL_KEYS[level]) })}
      </p>
    </div>
  );
}
