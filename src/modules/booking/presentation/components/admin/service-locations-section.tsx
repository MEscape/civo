import { CheckboxField } from '@components/shared/checkbox-field';

import { useTranslations } from '@i18n/client';

import { FormSection } from '../shared/form-section';

import type { LocationDto } from '../../dto/setup-dto';

export interface ServiceLocationsSectionProps {
  readonly idPrefix: string;
  readonly locations: readonly LocationDto[];
  readonly selectedIds: readonly string[];
  readonly error: string | undefined;
  readonly onChange: (next: readonly string[]) => void;
}

/** The places a service is offered at. */
export function ServiceLocationsSection({
  idPrefix,
  locations,
  selectedIds,
  error,
  onChange,
}: ServiceLocationsSectionProps) {
  const t = useTranslations('booking');

  return (
    <FormSection
      title={t('services.sections.locations')}
      description={t('services.sections.locationsHint')}
    >
      {locations.length === 0 && (
        <p className="text-sm text-copy-muted">{t('services.noLocations')}</p>
      )}
      {locations.map((location) => (
        <CheckboxField
          key={location.id}
          id={`${idPrefix}-loc-${location.id}`}
          label={location.name}
          checked={selectedIds.includes(location.id)}
          onChange={(event) => {
            onChange(
              event.target.checked
                ? [...selectedIds, location.id]
                : selectedIds.filter((value) => value !== location.id),
            );
          }}
        />
      ))}
      {error !== undefined && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </FormSection>
  );
}
