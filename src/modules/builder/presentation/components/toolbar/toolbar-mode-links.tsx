import { Button } from '@components/ui/button';
import { Eye, Pencil } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { modeChanged } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectMode } from '../../state/builder-selectors';

export interface ToolbarModeLinksProps {
  readonly publicSiteHref: string;
}

const LINK = 'text-sm text-copy-muted hover:underline';

export function ToolbarModeLinks({ publicSiteHref }: ToolbarModeLinksProps) {
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
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only">{t('toolbar.edit')}</span>
          </>
        ) : (
          <>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="max-sm:sr-only">{t('toolbar.preview')}</span>
          </>
        )}
      </Button>
      <Link
        href={publicSiteHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(LINK, 'hidden md:inline-flex')}
      >
        {t('toolbar.publicSite')}
        <span className="sr-only"> {t('toolbar.opensInNewTab')}</span>
      </Link>
    </>
  );
}
