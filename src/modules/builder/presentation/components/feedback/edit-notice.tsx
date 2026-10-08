import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { noticeDismissed } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectNoticeCode } from '../../state/builder-selectors';

import { ErrorMessage } from './error-message';

/** Explains why an edit was refused (a drop the tree rejected, a limit reached). */
export function EditNotice() {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const code = useBuilderSelector(selectNoticeCode);
  if (code === null) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-2">
      <ErrorMessage code={code} className="text-sm" />
      <Button variant="outline" size="sm" onClick={() => dispatch(noticeDismissed())}>
        {t('notice.dismiss')}
      </Button>
    </div>
  );
}
