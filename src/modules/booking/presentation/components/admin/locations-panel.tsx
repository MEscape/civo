import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { EntityPanel } from './entity-panel.client';
import { LocationForm } from './location-form.client';

import type { BookingSetupDto } from '../../dto/setup-dto';

export interface LocationsPanelProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  readonly canConfigure: boolean;
}

/** The configured locations, with "new" and "edit". */
export function LocationsPanel({ websiteId, setup, canConfigure }: LocationsPanelProps) {
  const t = useTranslations('booking');

  return (
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
        <LocationForm websiteId={websiteId} location={item} onSaved={onSaved} onCancel={onCancel} />
      )}
    />
  );
}
