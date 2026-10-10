import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';

import { EntityPanel } from './entity-panel.client';
import { ResourceForm } from './resource-form.client';

import type { ResourceKind } from '../../../application/contracts/booking-constraints';
import type { BookingSetupDto } from '../../dto/setup-dto';

export interface ResourcesPanelProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  readonly canConfigure: boolean;
}

function isResourceKind(type: string): type is ResourceKind {
  return Object.hasOwn(RESOURCE_TYPE_MESSAGE_KEYS, type);
}

/** The configured resources (employees, rooms, equipment), with "new" and "edit". */
export function ResourcesPanel({ websiteId, setup, canConfigure }: ResourcesPanelProps) {
  const t = useTranslations('booking');

  const locationName = (id: string | null) =>
    id === null
      ? t('resources.anyLocation')
      : (setup.locations.find((location) => location.id === id)?.name ?? id);

  return (
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
  );
}
