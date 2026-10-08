import { useTranslations } from '@i18n/client';

/** `bikeCount` and `bike_count` both read "Bike count". Dataset field names stay data-driven. */
export function humanizeFieldKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The label for an attribute. The few attributes the data contract itself
 * defines are translated; anything a municipality adds is shown as its own
 * (humanized) name.
 */
export function useFieldLabel(): (key: string) => string {
  const t = useTranslations('map');
  return (key) => {
    switch (key) {
      case 'status':
        return t('fields.status');
      case 'category':
        return t('fields.category');
      case 'value':
        return t('fields.value');
      case 'unit':
        return t('fields.unit');
      case 'observedAt':
        return t('fields.observedAt');
      default:
        return humanizeFieldKey(key);
    }
  };
}
