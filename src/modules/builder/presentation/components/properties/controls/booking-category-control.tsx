import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { useTranslations } from '@i18n/client';

import { useBuilderSession } from '../../../state/builder-session-context';

import type { ControlProps } from './control-props';

/** Radix items cannot carry an empty value, so "all categories" gets a sentinel no category equals. */
const ALL_VALUE = '__all__';

/**
 * Narrows the booking component to one category of the website's services. A stored category no
 * service uses any more stays selectable, so it is visible and can be changed.
 */
export function BookingCategoryControl({ id, value, onChange, onCommit }: ControlProps) {
  const t = useTranslations('builder');
  const { categories } = useBuilderSession().bookingChoices;
  const stored = typeof value === 'string' && value !== '' ? value : null;

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
        <SelectItem value={ALL_VALUE}>{t('properties.booking.allCategories')}</SelectItem>
        {stored !== null && !categories.includes(stored) && (
          <SelectItem value={stored}>
            {t('properties.booking.staleCategory', { value: stored })}
          </SelectItem>
        )}
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
