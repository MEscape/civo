'use client';

import { FieldMessage, FieldSuccess } from '@components/shared/field';
import { Wizard, WizardActions } from '@components/shared/wizard';

import { useTranslations } from '@i18n/client';

import { MAP_EDITOR_STEPS, MAP_STEP_LABELS } from '../../forms/map-editor-steps';
import { useMapEditor } from '../../hooks/use-map-editor';
import { mapRoutes } from '../../routes';

import { MapEditorFields } from './map-editor-fields';
import { MapEditorPreview } from './map-editor-preview.client';

import type { SavedMapView } from '../../../application/contracts/saved-map-views';
import type { MapEditorStep } from '../../forms/map-editor-steps';
import type { MapTiles } from '../canvas/map-canvas.client';

interface MapEditorFormProps {
  readonly websiteId: string;
  readonly initialMap: SavedMapView | null;
  readonly step: MapEditorStep;
  /** The map was just created: the first screen of it says so. */
  readonly isCreated: boolean;
  readonly datasets: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly tiles: MapTiles | null;
}

export function MapEditorForm({
  websiteId,
  initialMap,
  step,
  isCreated,
  datasets,
  canEdit,
  canPublish,
  tiles,
}: MapEditorFormProps) {
  const t = useTranslations('map');
  const editor = useMapEditor({ websiteId, initialMap, step, isCreated });
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <form onSubmit={editor.onSubmit} className="min-w-0" noValidate aria-busy={editor.isPending}>
        <Wizard
          steps={MAP_EDITOR_STEPS.map((key) => ({ key, label: t(MAP_STEP_LABELS[key]) }))}
          currentKey={step}
          status={
            editor.showSaved ? (
              <FieldSuccess>{t('management.saved')}</FieldSuccess>
            ) : (
              <FieldMessage id="map-editor-error" message={editor.formError} />
            )
          }
          actions={
            <WizardActions
              cancelHref={mapRoutes.list(websiteId)}
              hasPrevious={editor.steps.previous !== undefined}
              nextLabel={editor.steps.isLast ? undefined : t('management.next')}
              saveLabel={editor.isPending ? t('management.saving') : t('management.save')}
              isPending={editor.isPending || (editor.steps.isLast && !canEdit)}
              onBack={editor.steps.goBack}
              onNext={() => {
                void editor.steps.goNext();
              }}
            />
          }
        >
          <fieldset disabled={!canEdit || editor.isPending} className="space-y-5">
            <legend className="sr-only">{t('management.settings')}</legend>
            <MapEditorFields
              editor={editor}
              step={step}
              websiteId={websiteId}
              datasets={datasets}
              canPublish={canPublish}
              accessToken={tiles?.accessToken ?? null}
            />
          </fieldset>
        </Wizard>
      </form>
      <div className="min-w-0 xl:sticky xl:top-6">
        <MapEditorPreview
          websiteId={websiteId}
          heading={editor.heading}
          height={editor.height}
          preview={editor.preview.preview}
          tiles={tiles}
          onBoundsChange={editor.preview.onBoundsChange}
          isDrawing={editor.preview.isDrawing}
          errorCode={editor.preview.errorCode}
          onRetry={editor.preview.retry}
          viewKey={editor.preview.viewKey}
        />
      </div>
    </div>
  );
}
