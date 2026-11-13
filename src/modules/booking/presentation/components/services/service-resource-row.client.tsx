'use client';

import { Label } from '@components/ui/input';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { ResourceOptionDto } from '../../dto/service-dto';

/** What a service asks of a resource: nothing, that it is free for the appointment, or that it is used when free. */
export type ResourceNeed = 'none' | 'required' | 'optional';

const NEEDS = ['none', 'required', 'optional'] as const;

/** What a resource is, in a line: its kind and how many it takes, and what it is held for around an appointment. */
function ResourceFacts({ resource }: { readonly resource: ResourceOptionDto }) {
  const t = useTranslations('booking');
  const facts = [
    t(RESOURCE_TYPE_MESSAGE_KEYS[resource.type]),
    ...(resource.capacity === null
      ? []
      : [t('services.resources.capacity', { count: resource.capacity })]),
    ...(resource.setupMinutes === 0 && resource.teardownMinutes === 0
      ? []
      : [
          t('services.resources.buffers', {
            setup: resource.setupMinutes,
            teardown: resource.teardownMinutes,
          }),
        ]),
  ];
  return <p className="text-xs text-copy-muted">{facts.join(' · ')}</p>;
}

export interface ServiceResourceRowProps {
  readonly id: string;
  readonly resourceId: string;
  readonly need: ResourceNeed;
  /** Unknown when the resource is no longer one the location can assign. */
  readonly resource: ResourceOptionDto | undefined;
  readonly errorMessage: string | undefined;
  readonly onNeedChange: (need: ResourceNeed) => void;
}

/**
 * One resource of the location, with its facts and one choice: the service does not need it, needs it
 * (an appointment is offered only while it is free) or may use it (used when free). Every resource of
 * the place is a row, so nothing is added or taken away and nothing on the page moves when a choice is made.
 */
export function ServiceResourceRow({
  id,
  resourceId,
  need,
  resource,
  errorMessage,
  onNeedChange,
}: ServiceResourceRowProps) {
  const t = useTranslations('booking');
  const name = resource?.name ?? resourceId;
  const isInactive = resource !== undefined && !resource.isActive;
  const notes = [
    resource !== undefined && resource.usedByServices > 0
      ? t('services.resources.usedBy', { name, count: resource.usedByServices })
      : undefined,
    isInactive && need !== 'none' ? t('services.resources.inactiveWarning', { name }) : undefined,
    errorMessage,
  ].filter(isDefined);

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-copy">{name}</p>
        {resource !== undefined && <ResourceFacts resource={resource} />}
        {notes.map((note) => (
          <p
            key={note}
            className={
              isInactive || note === errorMessage
                ? 'text-xs text-warning'
                : 'text-xs text-copy-muted'
            }
          >
            {note}
          </p>
        ))}
      </div>
      <RadioGroup
        aria-label={t('services.resources.need', { name })}
        value={need}
        onValueChange={(value) => {
          onNeedChange(NEEDS.find((candidate) => candidate === value) ?? 'none');
        }}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {NEEDS.map((choice) => (
          <div key={choice} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${choice}`} value={choice} />
            <Label htmlFor={`${id}-${choice}`} className="font-normal">
              {t(`services.resources.needs.${choice}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </li>
  );
}
