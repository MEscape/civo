import { Button } from '@components/ui/button';
import { Eye, Pencil, Settings } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { modeChanged } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectMode } from '../../state/builder-selectors';

export interface ToolbarModeLinksProps {
  readonly publicSiteHref: string;
  /** `null` when the session may not manage the theme. */
  readonly settingsHref: string | null;
}

const LINK = 'text-sm text-copy-muted hover:underline';

export function ToolbarModeLinks({ publicSiteHref, settingsHref }: ToolbarModeLinksProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const mode = useBuilderSelector(selectMode);
  const isPreview = mode === 'preview';

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => dispatch(modeChanged(isPreview ? 'select' : 'preview'))}
      >
        {isPreview ? (
          <>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {t('toolbar.edit')}
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {t('toolbar.preview')}
          </>
        )}
      </Button>
      <Link href={publicSiteHref} target="_blank" rel="noopener noreferrer" className={LINK}>
        {t('toolbar.publicSite')}
        <span className="sr-only"> {t('toolbar.opensInNewTab')}</span>
      </Link>
      {settingsHref !== null && (
        <Link href={settingsHref} className={`${LINK} flex items-center gap-1.5`}>
          <Settings className="h-4 w-4" aria-hidden="true" />
          {t('toolbar.settings')}
        </Link>
      )}
    </>
  );
}
