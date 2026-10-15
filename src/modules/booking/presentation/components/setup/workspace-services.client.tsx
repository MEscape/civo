'use client';

import { useState, useTransition } from 'react';

import { ComboboxField } from '@components/shared/combobox-field';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { offerServiceAction } from '../../actions/offer-service-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { formErrorsOf } from '../../hooks/use-save-form';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { SERVICE_PRESETS } from '../../presets/booking-presets';
import { EntityPanel } from '../admin/entity-panel.client';
import { ServiceForm } from '../admin/service-form.client';

import type { ResourceKind } from '../../../application/contracts/booking-constraints';
import type {
  BookingOptionsDto,
  LocationDto,
  LocationOption,
  LocationWorkspaceDto,
  ResourceDto,
  ServiceDto,
} from '../../dto/setup-dto';
import type { FormErrors } from '../shared/form-error-summary';

export interface WorkspaceServicesProps {
  readonly location: LocationDto;
  readonly entries: LocationWorkspaceDto['services'];
  readonly resources: readonly ResourceDto[];
  /** Services of the website that are not offered here yet. */
  readonly otherServices: LocationWorkspaceDto['otherServices'];
  readonly options: BookingOptionsDto;
  readonly canConfigure: boolean;
  /** Services whose own hours reach beyond the opening hours being edited. */
  readonly conflictIds: ReadonlySet<string>;
}

const READINESS_BADGE = {
  ready: 'success',
  'awaiting-employees': 'warning',
  blocked: 'danger',
} as const;

const READINESS_KEY = {
  ready: 'services.feasibility.ready',
  'awaiting-employees': 'services.feasibility.awaiting',
  blocked: 'services.feasibility.blocked',
} as const;

function isResourceKind(type: string): type is ResourceKind {
  return Object.hasOwn(RESOURCE_TYPE_MESSAGE_KEYS, type);
}

interface ServiceEntry {
  readonly id: string;
  readonly service: ServiceDto;
  readonly readiness: LocationWorkspaceDto['services'][number]['readiness'];
}

/** A service that was being added here but does not fit as it is: opened in the form with what is wrong marked. */
interface Adjusting {
  readonly service: ServiceDto;
  readonly errors: FormErrors;
}

function locationOptionOf(location: LocationDto, options: BookingOptionsDto): LocationOption {
  return (
    options.locations.find((option) => option.id === location.id) ?? {
      id: location.id,
      name: location.name,
      timeZone: location.timeZone,
    }
  );
}

/**
 * The services offered at one location. Each card says whether it can be
 * booked yet and what it needs; the form opens in place, already knowing the
 * location, so there is nothing to choose about where. A service that exists
 * elsewhere is added here by searching for it, not made again: if it fits the
 * opening hours here it is simply added, and if it does not, its form opens
 * with the days that do not fit marked, to be fixed before it is saved.
 */
export function WorkspaceServices({
  location,
  entries,
  resources,
  otherServices,
  options,
  canConfigure,
  conflictIds,
}: WorkspaceServicesProps) {
  const t = useTranslations('booking');
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null);
  const items: ServiceEntry[] = entries.map(({ service, readiness }) => ({
    id: service.id,
    service,
    readiness,
  }));

  function offer(service: ServiceDto, isOffered: boolean) {
    startTransition(async () => {
      const result = await offerServiceAction({
        websiteId: location.websiteId,
        serviceId: service.id,
        locationId: location.id,
        isOffered,
      });
      if (result.ok) {
        setFailed(false);
        return;
      }
      const errors = formErrorsOf(result.error);
      if (isOffered && Object.keys(errors.fields).length > 0) {
        setAdjusting({ service, errors });
        return;
      }
      setFailed(true);
    });
  }

  function needsOf(service: ServiceDto): string {
    return service.requirements
      .map((requirement) => {
        const named = resources
          .filter((resource) => requirement.resourceIds?.includes(resource.id) === true)
          .map((resource) => resource.name);
        const kind = isResourceKind(requirement.resourceType)
          ? t(RESOURCE_TYPE_MESSAGE_KEYS[requirement.resourceType])
          : requirement.resourceType;
        return `${requirement.count}× ${named.length > 0 ? named.join(' / ') : kind}`;
      })
      .join(', ');
  }

  if (adjusting !== null) {
    return (
      <section aria-labelledby="services-title" className="space-y-4">
        <h2 id="services-title" className="sr-only">
          {t('workspace.services.title')}
        </h2>
        <p
          role="status"
          className="rounded-token border border-warning-border bg-warning-subtle p-3 text-sm text-warning"
        >
          {t('workspace.services.adjustHint', { name: adjusting.service.name })}
        </p>
        <ServiceForm
          websiteId={location.websiteId}
          location={locationOptionOf(location, options)}
          locationHours={planFormOf(location.openingHours).weekly}
          resources={options.resources}
          categories={options.categories}
          service={adjusting.service}
          initialErrors={adjusting.errors}
          onSaved={() => {
            setAdjusting(null);
          }}
          onCancel={() => {
            setAdjusting(null);
          }}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="services-title" className="space-y-4">
      <EntityPanel
        title={t('workspace.services.title')}
        titleId="services-title"
        intro={t('workspace.services.intro')}
        newLabel={t('services.new')}
        emptyText={t('workspace.services.empty')}
        items={items}
        label={(entry) => entry.service.name}
        canEdit={canConfigure}
        isHighlighted={(entry) => conflictIds.has(entry.id)}
        presets={SERVICE_PRESETS.map((preset) => ({
          key: preset.key,
          label: t(`presets.services.${preset.key}`),
        }))}
        summary={(entry) => (
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-medium text-copy">
              {entry.service.name}
              <Badge variant={READINESS_BADGE[entry.readiness]}>
                {t(READINESS_KEY[entry.readiness])}
              </Badge>
              {conflictIds.has(entry.id) && (
                <Badge variant="danger">{t('workspace.hoursConflict')}</Badge>
              )}
              {!entry.service.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
              {entry.service.locationIds.length > 1 && (
                <Badge variant="info">
                  {t('workspace.services.sharedWith', {
                    count: entry.service.locationIds.length - 1,
                  })}
                </Badge>
              )}
            </p>
            <p className="text-sm text-copy-muted">
              {t('workspace.services.glance', {
                minutes: entry.service.durationMinutes,
                interval: entry.service.slotIntervalMinutes,
              })}
              {' · '}
              {t('workspace.services.needs', { needs: needsOf(entry.service) })}
            </p>
            {canConfigure && entry.service.locationIds.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  offer(entry.service, false);
                }}
              >
                {t('workspace.services.removeHere')}
                <span className="sr-only"> {entry.service.name}</span>
              </Button>
            )}
          </div>
        )}
        renderForm={({ item, presetKey, onSaved, onCancel }) => (
          <ServiceForm
            websiteId={location.websiteId}
            location={locationOptionOf(location, options)}
            locationHours={planFormOf(location.openingHours).weekly}
            resources={options.resources}
            categories={options.categories}
            service={item?.service}
            presetKey={presetKey}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        )}
      />

      {canConfigure && (
        <div className="rounded-token border border-dashed border-border-strong p-4">
          <ComboboxField
            selectionMode="single"
            id="offer-existing-service"
            label={t('workspace.services.offerExisting')}
            hint={
              otherServices.length === 0
                ? t('workspace.services.offerNone')
                : t('workspace.services.offerExistingHint')
            }
            placeholder={t('workspace.services.offerPlaceholder')}
            disabled={isPending || otherServices.length === 0}
            options={otherServices.map((service) => ({ value: service.id, label: service.name }))}
            value=""
            emptyText={t('form.noMatches')}
            onValueChange={(serviceId) => {
              const chosen = otherServices.find((service) => service.id === serviceId);
              if (chosen !== undefined) {
                offer(chosen, true);
              }
            }}
          />
          {failed && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {t('workspace.services.offerFailed')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
