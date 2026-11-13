'use client';

import { CheckboxField, TextField } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { SAVED_MAP_LIMITS } from '../../../application/contracts/saved-map-views';

import { MapAppearanceFields } from './map-appearance-fields';
import { MapAreaFields } from './map-area-fields';
import { MapContentEditor } from './map-content-editor';

import type { MapEditorStep } from '../../forms/map-editor-steps';
import type { useMapEditor } from '../../hooks/use-map-editor';

interface MapEditorFieldsProps {
  readonly editor: ReturnType<typeof useMapEditor>;
  readonly step: MapEditorStep;
  readonly websiteId: string;
  readonly datasets: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly canPublish: boolean;
  /** The map tiles' token, which also finds addresses. */
  readonly accessToken: string | null;
}

export function MapEditorFields({
  editor,
  step,
  websiteId,
  datasets,
  canPublish,
  accessToken,
}: MapEditorFieldsProps) {
  const t = useTranslations('map');
  return (
    <>
      {step === 'basics' && (
        <>
          <p className="text-sm text-copy-muted">{t('management.basicsHint')}</p>
          <TextField
            {...editor.form.register('name')}
            id="map-name"
            label={t('management.name')}
            maxLength={SAVED_MAP_LIMITS.name}
            error={editor.fieldError(editor.form.formState.errors.name?.message)}
          />
          <TextField
            {...editor.form.register('description')}
            id="map-description"
            label={t('management.description')}
            maxLength={SAVED_MAP_LIMITS.description}
            error={editor.fieldError(editor.form.formState.errors.description?.message)}
          />
        </>
      )}
      {step === 'content' && (
        <MapContentEditor
          websiteId={websiteId}
          form={editor.form}
          datasets={datasets}
          errorText={editor.fieldError}
          mode={editor.contentMode}
          onModeChange={editor.setContentMode}
          accessToken={accessToken}
        />
      )}
      {step === 'design' && (
        <div className="space-y-5">
          <MapAppearanceFields
            form={editor.form}
            errorText={editor.fieldError}
            attributes={editor.preview.attributes}
            hasStreetTiles={accessToken !== null}
          />
          <MapAreaFields
            form={editor.form}
            errorText={editor.fieldError}
            canUseVisibleArea={editor.preview.visibleBounds !== null}
            onUseVisibleArea={editor.useVisibleArea}
          />
        </div>
      )}
      {step === 'review' && (
        <>
          <p className="text-sm text-copy-muted">{t('management.reviewHint')}</p>
          <dl className="space-y-3 rounded-token border border-border bg-canvas p-4 text-sm">
            <div>
              <dt className="text-copy-muted">{t('management.name')}</dt>
              <dd className="font-medium text-copy">{editor.form.getValues('name')}</dd>
            </div>
            <div>
              <dt className="text-copy-muted">{t('management.content')}</dt>
              <dd className="text-copy">
                {t('management.contentSummary', {
                  locations: editor.form.getValues('settings.locations')?.length ?? 0,
                  layers: editor.form.getValues('settings.layers').length,
                })}
              </dd>
            </div>
          </dl>
          <CheckboxField
            {...editor.form.register('settings.isPublic')}
            id="map-public"
            label={t('management.allowPublic')}
            disabled={!canPublish}
            hint={t('management.publicHint')}
          />
          {!canPublish && (
            <p className="text-sm text-copy-muted">{t('management.publishPermission')}</p>
          )}
        </>
      )}
    </>
  );
}
