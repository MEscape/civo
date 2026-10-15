'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { planFormOf } from '../../drafts/availability-plan-form';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';
import { RESOURCE_PRESETS } from '../../presets/booking-presets';
import { EntityPanel } from '../admin/entity-panel.client';
import { ResourceForm } from '../admin/resource-form.client';

import type { ResourceKind } from '../../../application/contracts/booking-constraints';
import type { BookingOptionsDto, LocationDto, ResourceDto } from '../../dto/setup-dto';

export interface WorkspaceResourcesProps {
  readonly location: LocationDto;
  readonly resources: readonly ResourceDto[];
  readonly options: BookingOptionsDto;
  readonly canConfigure: boolean;
  /** Resources whose own hours reach beyond the opening hours being edited. */
  readonly conflictIds: ReadonlySet<string>;
}

function isResourceKind(type: string): type is ResourceKind {
  return Object.hasOwn(RESOURCE_TYPE_MESSAGE_KEYS, type);
}

/**
 * The rooms and equipment of one location, which the services here draw on. One
 * that travels (a projector, a vehicle) is marked as available at every
 * location, and then shows up in each of them. People are not listed: an
 * employee sets up their own calendar, seen under Team.
 */
export function WorkspaceResources({
  location,
  resources,
  options,
  canConfigure,
  conflictIds,
}: WorkspaceResourcesProps) {
  const t = useTranslations('booking');

  return (
    <section aria-labelledby="resources-title">
      <EntityPanel
        title={t('workspace.resources.title')}
        titleId="resources-title"
        intro={t('workspace.resources.intro')}
        newLabel={t('resources.new')}
        emptyText={t('workspace.resources.empty')}
        items={resources}
        label={(resource) => resource.name}
        canEdit={canConfigure}
        isHighlighted={(resource) => conflictIds.has(resource.id)}
        presets={RESOURCE_PRESETS.map((preset) => ({
          key: preset.key,
          label: t(`presets.resources.${preset.key}`),
        }))}
        summary={(resource) => (
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-medium text-copy">
              {resource.name}
              {resource.locationId === null && (
                <Badge variant="info">{t('workspace.resources.everywhere')}</Badge>
              )}
              {conflictIds.has(resource.id) && (
                <Badge variant="danger">{t('workspace.hoursConflict')}</Badge>
              )}
              {!resource.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
            </p>
            <p className="text-sm text-copy-muted">
              {isResourceKind(resource.type)
                ? t(RESOURCE_TYPE_MESSAGE_KEYS[resource.type])
                : resource.type}
              {resource.capacity !== null &&
                ` · ${t('workspace.resources.capacity', { count: resource.capacity })}`}
              {resource.skills.length > 0 && ` · ${resource.skills.join(', ')}`}
            </p>
          </div>
        )}
        renderForm={({ item, presetKey, onSaved, onCancel }) => (
          <ResourceForm
            websiteId={location.websiteId}
            location={
              options.locations.find((option) => option.id === location.id) ?? {
                id: location.id,
                name: location.name,
                timeZone: location.timeZone,
              }
            }
            locationHours={planFormOf(location.openingHours).weekly}
            skillOptions={options.skills}
            resource={item}
            presetKey={presetKey}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        )}
      />
    </section>
  );
}
