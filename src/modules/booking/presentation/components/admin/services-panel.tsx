import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { EntityPanel } from './entity-panel.client';
import { ServiceForm } from './service-form.client';

import type { BookingSetupDto } from '../../dto/setup-dto';

export interface ServicesPanelProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  readonly canConfigure: boolean;
}

/** The configured services, with "new" and "edit". */
export function ServicesPanel({ websiteId, setup, canConfigure }: ServicesPanelProps) {
  const t = useTranslations('booking');

  return (
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
  );
}
