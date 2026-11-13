'use client';

import { dataSourceRoutes } from '@modules/data-sources/client';

import { FieldMessage } from '@components/shared/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { MapLayersEditor } from './map-layers-editor';
import { MapLocationsEditor } from './map-locations-editor';

import type { MapEditorValues } from '../../hooks/use-map-editor';
import type { UseFormReturn } from 'react-hook-form';

interface MapContentEditorProps {
  readonly websiteId: string;
  readonly form: UseFormReturn<MapEditorValues>;
  readonly datasets: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly errorText: (message: string | undefined) => string | undefined;
  readonly mode: 'locations' | 'datasets';
  readonly onModeChange: (mode: 'locations' | 'datasets') => void;
  readonly accessToken: string | null;
}

export function MapContentEditor({
  websiteId,
  form,
  datasets,
  errorText,
  mode,
  onModeChange,
  accessToken,
}: MapContentEditorProps) {
  const t = useTranslations('map');
  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('management.contentHint')}</p>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (value === 'locations' || value === 'datasets') {
            onModeChange(value);
          }
        }}
      >
        <TabsList aria-label={t('management.content')}>
          <TabsTrigger value="locations">{t('management.locations')}</TabsTrigger>
          <TabsTrigger value="datasets">{t('management.connectedData')}</TabsTrigger>
        </TabsList>
        <TabsContent value="locations">
          <MapLocationsEditor form={form} errorText={errorText} accessToken={accessToken} />
        </TabsContent>
        <TabsContent value="datasets">
          <div className="space-y-4">
            <MapLayersEditor form={form} datasets={datasets} errorText={errorText} />
            <Link
              href={dataSourceRoutes.sources(websiteId)}
              className="text-sm font-medium text-primary-copy hover:underline"
            >
              {t('management.openDataSources')}
            </Link>
          </div>
        </TabsContent>
      </Tabs>
      <FieldMessage
        id="map-content-error"
        message={errorText(
          form.formState.errors.settings?.layers?.message ??
            form.formState.errors.settings?.layers?.root?.message,
        )}
      />
    </div>
  );
}
