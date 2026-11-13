'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { EXCEPTION_TABS } from '../../forms/exceptions';

import type { ExceptionTab } from '../../forms/exceptions';

export interface ExceptionsToolbarProps {
  readonly tab: ExceptionTab;
  readonly counts: Readonly<Record<ExceptionTab, number>>;
  readonly onSelectTab: (tab: ExceptionTab) => void;
  readonly onAdd: () => void;
  readonly onImport: () => void;
}

/**
 * The filter tabs of the list (pressed buttons, each with its count) and the two ways to add:
 * a day of your own, or the holidays of a state. Both buttons stay at the far edge whatever the
 * tabs say, so nothing under the pointer moves when a count changes.
 */
export function ExceptionsToolbar({
  tab,
  counts,
  onSelectTab,
  onAdd,
  onImport,
}: ExceptionsToolbarProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label={t('exceptions.tabsLabel')} className="flex flex-wrap gap-2">
        {EXCEPTION_TABS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? 'default' : 'outline'}
            aria-pressed={tab === key}
            onClick={() => {
              onSelectTab(key);
            }}
          >
            {t(`exceptions.tabs.${key}`, { count: counts[key] })}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onImport}>
          {t('exceptions.import.title')}
        </Button>
        <Button type="button" onClick={onAdd}>
          {t('exceptions.add')}
        </Button>
      </div>
    </div>
  );
}
