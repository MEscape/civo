import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { messageKeyForCode } from '../../messages/message-keys';

import type { MapModel } from '../../../application/contracts/map-views';

function Note({ children }: { readonly children: string }) {
  return (
    <p
      role="status"
      className="rounded-token border border-border bg-surface px-4 py-3 text-sm text-copy-muted"
    >
      {children}
    </p>
  );
}

interface MapNotesProps {
  readonly model: MapModel;
  readonly unavailableLayers: number;
  readonly hasCanvasFailed: boolean;
}

/** Everything that tells a visitor the map is incomplete, unavailable or empty, as text. */
export function MapNotes({ model, unavailableLayers, hasCanvasFailed }: MapNotesProps) {
  const t = useTranslations('map');
  const hasFeatures = model.featureCount > 0;

  return (
    <>
      {model.isTruncated === true && (
        <Alert variant="warning" role="status">
          {t('states.truncated')}
        </Alert>
      )}
      {unavailableLayers > 0 && (
        <Note>{t('states.layersUnavailable', { count: unavailableLayers })}</Note>
      )}
      {model.issues.dropped > 0 && (
        <div className="space-y-1">
          <Note>
            {t('states.skipped', { dropped: model.issues.dropped, total: model.issues.received })}
          </Note>
          <ul className="list-inside list-disc px-4 text-sm text-copy-muted">
            {Object.entries(model.issues.byReason).map(([code, count]) => (
              <li key={code}>
                {t('states.skippedReason', { reason: t(messageKeyForCode(code)), count })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!hasFeatures && <Note>{t('states.empty')}</Note>}
      {hasFeatures && hasCanvasFailed && <Note>{t('states.failed')}</Note>}
    </>
  );
}
