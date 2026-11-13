import { Alert } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';

import { getTranslations } from '@i18n/server';

import type { PreviewFidelityView } from '../../../application/contracts/preview-views';

/**
 * Says when today's components cannot draw a release as it was: older versions are drawn with
 * the current ones, and a component that no longer exists is drawn as a placeholder. Nothing
 * is shown for a release that can be drawn exactly.
 */
export async function FidelityNotice({ fidelity }: { readonly fidelity: PreviewFidelityView }) {
  if (fidelity.status === 'exact') {
    return null;
  }
  const t = await getTranslations('release');
  const isGone = fidelity.status === 'unavailable';

  return (
    <Alert variant={isGone ? 'danger' : 'warning'} role="status">
      <p className="font-heading text-base font-semibold">
        {isGone ? t('preview.fidelity.unavailableTitle') : t('preview.fidelity.changedTitle')}
      </p>
      <p className="mt-1 text-sm text-copy">
        {isGone ? t('preview.fidelity.unavailable') : t('preview.fidelity.changed')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {fidelity.deviations.map(({ type, pinnedVersion, currentVersion }) => (
          <li key={type}>
            <Badge variant={currentVersion === null ? 'danger' : 'warning'}>
              {currentVersion === null
                ? t('preview.fidelity.gone', { component: type, from: pinnedVersion })
                : t('preview.fidelity.versionChange', {
                    component: type,
                    from: pinnedVersion,
                    to: currentVersion,
                  })}
            </Badge>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
