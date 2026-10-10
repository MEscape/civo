'use client';

import { Badge } from '@components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';

import { EntityPanel } from './entity-panel.client';
import { LocationForm } from './location-form.client';
import { OperationsCalendar } from './operations-calendar.client';
import { ResourceForm } from './resource-form.client';
import { ServiceForm } from './service-form.client';

import type { ResourceKind } from '../../../application/contracts/booking-constraints';
import type { BookingSetupDto } from '../../dto/setup-dto';

export interface BookingAdminProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  readonly canConfigure: boolean;
  readonly canManage: boolean;
  /** `calendar`: the operations calendar alone (the page component); `full`: calendar and configuration. */
  readonly scope: 'calendar' | 'full';
}

function isResourceKind(type: string): type is ResourceKind {
  return Object.hasOwn(RESOURCE_TYPE_MESSAGE_KEYS, type);
}

/**
 * The administration screen: the operations calendar first, because that is
 * what staff open it for, then services, resources and locations. Entries a
 * person may not change are listed read-only.
 */
export function BookingAdmin({
  websiteId,
  setup,
  canConfigure,
  canManage,
  scope,
}: BookingAdminProps) {
  const t = useTranslations('booking');

  if (scope === 'calendar') {
    return <OperationsCalendar websiteId={websiteId} setup={setup} canManage={canManage} />;
  }

  const locationName = (id: string | null) =>
    id === null
      ? t('resources.anyLocation')
      : (setup.locations.find((location) => location.id === id)?.name ?? id);

  return (
    <Tabs defaultValue="calendar" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="calendar">{t('admin.tabs.calendar')}</TabsTrigger>
        <TabsTrigger value="services">{t('admin.tabs.services')}</TabsTrigger>
        <TabsTrigger value="resources">{t('admin.tabs.resources')}</TabsTrigger>
        <TabsTrigger value="locations">{t('admin.tabs.locations')}</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar">
        <OperationsCalendar websiteId={websiteId} setup={setup} canManage={canManage} />
      </TabsContent>

      <TabsContent value="services">
        <EntityPanel
          title={t('services.title')}
          intro={t('services.intro')}
          newLabel={t('services.new')}
          emptyText={t('services.empty')}
          items={setup.services}
          label={(service) => service.name}
          canEdit={canConfigure}
          summary={(service) => (
            <div className="space-y-1">
              <p className="font-medium text-copy">
                {service.name}{' '}
                {!service.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
                {service.locationIds.length === 0 && (
                  <Badge variant="warning">{t('services.noLocationBadge')}</Badge>
                )}
              </p>
              <p className="text-sm text-copy-muted">
                {t('services.summary', {
                  minutes: service.durationMinutes,
                  locations: service.locationIds.length,
                })}
              </p>
            </div>
          )}
          renderForm={({ item, onSaved, onCancel }) => (
            <ServiceForm
              websiteId={websiteId}
              locations={setup.locations}
              resources={setup.resources}
              service={item}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          )}
        />
      </TabsContent>

      <TabsContent value="resources">
        <EntityPanel
          title={t('resources.title')}
          intro={t('resources.intro')}
          newLabel={t('resources.new')}
          emptyText={t('resources.empty')}
          items={setup.resources}
          label={(resource) => resource.name}
          canEdit={canConfigure}
          summary={(resource) => (
            <div className="space-y-1">
              <p className="font-medium text-copy">
                {resource.name}{' '}
                {!resource.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
              </p>
              <p className="text-sm text-copy-muted">
                {isResourceKind(resource.type)
                  ? t(RESOURCE_TYPE_MESSAGE_KEYS[resource.type])
                  : resource.type}
                {' · '}
                {locationName(resource.locationId)}
                {resource.skills.length > 0 && ` · ${resource.skills.join(', ')}`}
              </p>
            </div>
          )}
          renderForm={({ item, onSaved, onCancel }) => (
            <ResourceForm
              websiteId={websiteId}
              locations={setup.locations}
              resource={item}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          )}
        />
      </TabsContent>

      <TabsContent value="locations">
        <EntityPanel
          title={t('locations.title')}
          intro={t('locations.intro')}
          newLabel={t('locations.new')}
          emptyText={t('locations.empty')}
          items={setup.locations}
          label={(location) => location.name}
          canEdit={canConfigure}
          summary={(location) => (
            <div className="space-y-1">
              <p className="font-medium text-copy">
                {location.name}{' '}
                {!location.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
              </p>
              <p className="text-sm text-copy-muted">
                {location.address ?? t('location.virtual')}
                {' · '}
                {location.timeZone}
              </p>
            </div>
          )}
          renderForm={({ item, onSaved, onCancel }) => (
            <LocationForm
              websiteId={websiteId}
              location={item}
              onSaved={onSaved}
              onCancel={onCancel}
            />
          )}
        />
      </TabsContent>
    </Tabs>
  );
}
