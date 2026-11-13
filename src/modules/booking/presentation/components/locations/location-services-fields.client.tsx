'use client';

import { useId } from 'react';

import { CheckboxField } from '@components/shared/field';
import { RadioCardGroup } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { isDefined } from '@lib/utils';

import { ADOPT_MODES } from '../../../application/contracts/booking-constraints';
import { groupOffered } from '../../forms/offered-services';
import { FormSection } from '../shared/form-section';

import type { AdoptableServiceDto } from '../../dto/service-dto';
import type { Offer } from '../../hooks/use-location-offer';

export interface LocationServicesFieldsProps {
  /** Every service that is on at some location, which the new one could start with. */
  readonly services: readonly AdoptableServiceDto[];
  readonly offer: Offer;
  readonly isPending: boolean;
}

/**
 * The step of a new location that takes over services other locations already offer, by category: a
 * choice of which, and whether each is an independent copy or a link to the original. Nothing is
 * created here: the services are taken over once the location exists, and the step is optional (they
 * can be added any time under "Services").
 */
export function LocationServicesFields({
  services,
  offer,
  isPending,
}: LocationServicesFieldsProps) {
  const t = useTranslations('booking');
  const id = useId();
  const groups = groupOffered(services, t('services.list.noCategory'));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <FormSection title={t('form.services.title')} description={t('form.services.description')}>
        <div className="divide-y divide-border overflow-hidden rounded-token border border-border bg-surface">
          {groups.map((group) => {
            const ids = group.items.map((service) => service.id);
            const chosen = ids.filter((serviceId) => offer.isChosen(serviceId)).length;
            return (
              <fieldset key={group.key} className="space-y-3 p-4">
                <legend className="sr-only">{group.label}</legend>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-copy">{group.label}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      offer.setMany(ids, chosen !== ids.length);
                    }}
                  >
                    {chosen === ids.length ? t('form.services.none') : t('form.services.all')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {group.items.map((service) => (
                    <CheckboxField
                      key={service.id}
                      id={`${id}-${service.id}`}
                      label={[
                        service.name,
                        t('services.duration', { minutes: service.durationMinutes }),
                        service.source?.name,
                      ]
                        .filter(isDefined)
                        .join(' · ')}
                      checked={offer.isChosen(service.id)}
                      disabled={isPending}
                      onChange={(event) => {
                        offer.setMany([service.id], event.target.checked);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </FormSection>

      <FormSection title={t('form.services.chosen', { count: offer.count })}>
        <RadioCardGroup
          legend={t('services.adopt.modeLegend')}
          name={`${id}-mode`}
          value={offer.mode}
          disabled={isPending}
          options={ADOPT_MODES.map((value) => ({
            value,
            label: t(`services.adopt.modes.${value}.label`),
            description: t(`services.adopt.modes.${value}.description`),
          }))}
          onValueChange={(value) => {
            offer.setMode(ADOPT_MODES.find((candidate) => candidate === value) ?? 'copy');
          }}
        />
        <p className="text-xs text-copy-muted">{t('form.services.later')}</p>
      </FormSection>
    </div>
  );
}
