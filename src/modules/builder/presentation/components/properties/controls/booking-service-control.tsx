import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { bookingServiceChoices } from '../../../properties/booking-choices';
import { useBuilderSession } from '../../../state/builder-session-context';

import type { ControlProps } from './control-props';

/** Radix items cannot carry an empty value, so "every service" gets a sentinel no id equals. */
const ALL_VALUE = '__all__';

/**
 * Narrows the booking component to one of the website's running services, those of the chosen
 * category first. A stored service that no longer runs stays selectable, marked, so the editor
 * sees why visitors cannot book it.
 */
export function BookingServiceControl({ id, value, nodeProps, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const { bookingChoices } = useBuilderSession();
  const stored = typeof value === 'string' && value !== '' ? value : null;
  const { options, isStale } = bookingServiceChoices(bookingChoices, {
    category: nodeProps['category'],
    stored,
  });

  return (
    <Select
      value={stored ?? ALL_VALUE}
      onValueChange={(chosen) => {
        onChange(chosen === ALL_VALUE ? undefined : chosen);
        onCommit();
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{t('properties.booking.allServices')}</SelectItem>
        {isStale && stored !== null && (
          <SelectItem value={stored}>{t('properties.booking.staleService')}</SelectItem>
        )}
        {options.map((service) => (
          <SelectItem key={service.id} value={service.id}>
            {service.category === null
              ? service.name
              : t('properties.booking.serviceOption', {
                  name: service.name,
                  category: service.category,
                })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
