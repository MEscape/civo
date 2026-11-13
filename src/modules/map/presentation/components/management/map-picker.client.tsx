'use client';

import { Alert } from '@components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useMapPicker } from '../../hooks/use-map-picker';
import { mapRoutes } from '../../routes';

interface MapPickerProps {
  readonly id: string;
  readonly websiteId: string;
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
  readonly onCommit: () => void;
}

const NO_MAP = 'none';

/** Shared browser entry for selecting a saved map; a picked id never decides the rendering website. */
export function MapPicker({ id, websiteId, value, onChange, onCommit }: MapPickerProps) {
  const t = useTranslations('map');
  const picker = useMapPicker(websiteId);
  return (
    <div className="space-y-2">
      <Select
        value={value ?? NO_MAP}
        onOpenChange={picker.handleOpenChange}
        onValueChange={(chosen) => {
          onChange(chosen === NO_MAP ? undefined : chosen);
          onCommit();
        }}
      >
        <SelectTrigger id={id} aria-busy={picker.isPending}>
          <SelectValue placeholder={t('picker.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_MAP}>{t('picker.legacy')}</SelectItem>
          {picker.items.map((map) => (
            <SelectItem key={map.id} value={map.id}>
              {map.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {picker.isPending && (
        <p role="status" className="text-xs text-copy-muted">
          {t('picker.loading')}
        </p>
      )}
      {picker.hasFailed && (
        <Alert variant="warning" role="status">
          {t('picker.failed')}
        </Alert>
      )}
      {picker.isTruncated && (
        <Alert variant="warning" role="status">
          {t('picker.truncated')}
        </Alert>
      )}
      {/* Everything about the map itself is set in the map editor, not in this panel. */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {value !== undefined && (
          <Link
            href={mapRoutes.edit(websiteId, value)}
            className="font-medium text-primary-copy hover:underline"
          >
            {t('management.configureMap')}
          </Link>
        )}
        <Link href={mapRoutes.create(websiteId)} className="text-primary-copy hover:underline">
          {t('management.newMap')}
        </Link>
        <Link href={mapRoutes.list(websiteId)} className="text-primary-copy hover:underline">
          {t('management.manageMaps')}
        </Link>
      </div>
    </div>
  );
}
