'use client';

import { useId } from 'react';

import { AlertTriangle } from '@components/icons/icons';
import { Label } from '@components/ui/input';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { FIT_MESSAGE_KEYS, REASON_MESSAGE_KEYS } from '../../messages/message-keys';

import type { AssignmentCandidatesDto } from '../../dto/booking-dto';

type Candidate = AssignmentCandidatesDto['eligible'][number];
type Unavailable = AssignmentCandidatesDto['unavailable'][number];

type Reason = Candidate['fit']['reasons'][number];

const ASPECT_OF = {
  'service-preferred': ['preferred', 'service'],
  'time-in-window': ['preferred', 'time'],
  'service-not-preferred': ['notPreferred', 'service'],
  'time-outside-window': ['notPreferred', 'time'],
} as const satisfies Record<Reason, readonly ['preferred' | 'notPreferred', 'service' | 'time']>;

export interface CandidateChoiceProps {
  readonly candidates: readonly Candidate[];
  readonly chosen: string | null;
  readonly onChoose: (resourceId: string) => void;
  readonly nameOf: (resourceId: string) => string;
}

/** The people who can take the booking, best fit first, as one radio group: the arrow keys move through it. */
export function CandidateChoice({ candidates, chosen, onChoose, nameOf }: CandidateChoiceProps) {
  const t = useTranslations('booking');
  const groupId = useId();
  /** What the person's preferences say about this booking, in words: "Prefers: this location, this time". */
  const preferenceOf = (reasons: readonly Reason[]) => {
    const said = (side: 'preferred' | 'notPreferred') =>
      reasons
        .filter((reason) => ASPECT_OF[reason][0] === side)
        .map((reason) => t(`bookings.assign.aspect.${ASPECT_OF[reason][1]}`));
    const parts = [
      ...(said('preferred').length > 0
        ? [t('bookings.assign.preferred', { what: said('preferred').join(', ') })]
        : []),
      ...(said('notPreferred').length > 0
        ? [t('bookings.assign.notPreferred', { what: said('notPreferred').join(', ') })]
        : []),
    ];
    return parts.length > 0 ? parts.join(' · ') : t('bookings.assign.noPreference');
  };

  if (candidates.length === 0) {
    return <p className="py-3 text-sm text-copy-muted">{t('bookings.assign.none')}</p>;
  }
  return (
    <RadioGroup
      aria-label={t('bookings.assign.choose')}
      value={chosen ?? ''}
      onValueChange={onChoose}
      className="gap-0 divide-y divide-border"
    >
      {candidates.map(({ resourceId, fit }) => (
        <div key={resourceId} className="flex items-center gap-3 py-3">
          <RadioGroupItem id={`${groupId}-${resourceId}`} value={resourceId} />
          <Label
            htmlFor={`${groupId}-${resourceId}`}
            className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-2 text-sm"
          >
            <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
              <span className="block font-medium text-copy">{nameOf(resourceId)}</span>
              <span className="block text-xs font-normal text-copy-muted">
                {preferenceOf(fit.reasons)}
              </span>
            </span>
            <span className="text-copy-muted">{t(FIT_MESSAGE_KEYS[fit.level])}</span>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

export interface UnavailableListProps {
  readonly unavailable: readonly Unavailable[];
  readonly nameOf: (resourceId: string) => string;
  /** The booking's location zone: a colliding appointment is told on its clock. */
  readonly timeZone: string;
}

/** Who cannot take the booking, each with every reason in words. */
export function UnavailableList({ unavailable, nameOf, timeZone }: UnavailableListProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const iso = (instant: number) => new Date(instant).toISOString();
  const textOf = (reason: Unavailable['reasons'][number]) => {
    switch (reason.code) {
      case 'missing-qualification':
        return t(REASON_MESSAGE_KEYS[reason.code], { skills: reason.missing.join(', ') });
      case 'time-conflict':
        return t(REASON_MESSAGE_KEYS[reason.code], {
          time: format.timeRange(iso(reason.with.start), iso(reason.with.end), timeZone),
        });
      default:
        return t(REASON_MESSAGE_KEYS[reason.code]);
    }
  };

  if (unavailable.length === 0) {
    return <p className="py-3 text-sm text-copy-muted">{t('bookings.assign.none')}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {unavailable.map(({ resourceId, reasons }) => (
        <li key={resourceId} className="flex gap-2 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-copy-muted" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <span className="font-medium text-copy">{nameOf(resourceId)}</span>
            <span className="text-copy-muted"> – {reasons.map(textOf).join('; ')}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
