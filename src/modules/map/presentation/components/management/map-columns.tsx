import { ArrowRight } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import type { getAppFormatters, getTranslations } from '@i18n/server';

import { mapRoutes } from '../../routes';

import { DeleteMapButton } from './delete-map-button.client';
import { MapUsedOn } from './map-used-on';

import type { SavedMapView } from '../../../application/contracts/saved-map-views';
import type { MapUsage } from '../../dto/map-usage-dto';
import type { DeleteMapAction } from '../../hooks/use-delete-map';

interface MapColumnsInput {
  readonly t: Awaited<ReturnType<typeof getTranslations<'map'>>>;
  readonly format: Awaited<ReturnType<typeof getAppFormatters>>;
  readonly websiteId: string;
  readonly usage: MapUsage;
  /** Absent when the person may not delete maps. */
  readonly deleteMap: { readonly action: DeleteMapAction; readonly inUseCode: string } | undefined;
  readonly canPublish: boolean;
}

/**
 * The columns of the list of maps: the map, what it shows, the components placing it, whether
 * visitors may see it, when it last changed, the way to its page and its deletion.
 */
export function mapColumns({
  t,
  format,
  websiteId,
  usage,
  deleteMap,
  canPublish,
}: MapColumnsInput): ReadonlyArray<ResponsiveColumn<SavedMapView>> {
  return [
    {
      id: 'name',
      label: t('management.name'),
      cell: (map) => (
        <div className="min-w-0 space-y-1">
          <Link
            href={mapRoutes.edit(websiteId, map.id)}
            className="rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            {map.name}
          </Link>
          {map.description !== null && (
            <p className="line-clamp-2 text-xs text-copy-muted">{map.description}</p>
          )}
        </div>
      ),
    },
    {
      id: 'content',
      label: t('management.content'),
      cell: (map) => {
        const locations = map.settings.locations?.length ?? 0;
        const layers = map.settings.layers.length;
        return (
          <div className="space-y-0.5 text-sm">
            {locations > 0 && (
              <p className="text-copy">{t('management.locationCount', { count: locations })}</p>
            )}
            {layers > 0 && (
              <p className={locations > 0 ? 'text-xs text-copy-muted' : 'text-copy'}>
                {t('management.layerCount', { count: layers })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'usage',
      label: t('management.usedOn'),
      cell: (map) => <MapUsedOn t={t} pages={usage === null ? null : (usage[map.id] ?? [])} />,
    },
    {
      id: 'visibility',
      label: t('management.visibility'),
      cell: (map) => (
        <Badge variant={map.settings.isPublic ? 'success' : 'default'}>
          {map.settings.isPublic ? t('management.public') : t('management.private')}
        </Badge>
      ),
    },
    {
      id: 'updated',
      label: t('management.updated'),
      cell: (map) => (
        <time dateTime={map.updatedAt} className="text-sm text-copy">
          {format.dateTime(new Date(map.updatedAt))}
        </time>
      ),
    },
    {
      id: 'actions',
      label: t('management.actions'),
      isAction: true,
      cell: (map) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={mapRoutes.edit(websiteId, map.id)}
              aria-label={t('management.openLabel', { name: map.name })}
            >
              {t('management.open')}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
          {deleteMap !== undefined && (canPublish || !map.settings.isPublic) && (
            <DeleteMapButton
              websiteId={websiteId}
              map={{ id: map.id, name: map.name }}
              deleteMap={deleteMap.action}
              inUseCode={deleteMap.inUseCode}
              usedOn={usage === null ? null : (usage[map.id] ?? [])}
              size="sm"
            />
          )}
        </div>
      ),
    },
  ];
}
