'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { ComponentDetails } from './component-update-details';

import type { ComponentUpdateView } from '../../application/contracts/release-views';

const STATUS_VARIANTS = {
  upgradable: 'success',
  needs_review: 'warning',
  unresolvable: 'danger',
} as const satisfies Record<ComponentUpdateView['status'], 'success' | 'warning' | 'danger'>;

const COLUMNS = {
  name: 'sm:col-span-5',
  version: 'sm:col-span-3',
  pages: 'sm:col-span-2',
  status: 'sm:col-span-2',
} as const;

/** The components with something to update, one open at a time or several, each saying what changes. */
export function ComponentList({
  components,
  labels,
}: {
  readonly components: readonly ComponentUpdateView[];
  readonly labels: Readonly<Record<string, string>>;
}) {
  const t = useTranslations('release');

  return (
    <div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-12 gap-2 border-b border-border px-4 py-2 pr-10 text-xs font-medium text-copy-muted sm:grid"
      >
        <span className={COLUMNS.name}>{t('updates.columns.component')}</span>
        <span className={COLUMNS.version}>{t('updates.columns.version')}</span>
        <span className={COLUMNS.pages}>{t('updates.columns.affects')}</span>
        <span className={COLUMNS.status}>{t('updates.columns.status')}</span>
      </div>
      <Accordion type="multiple" aria-label={t('updates.columns.component')}>
        {components.map((component) => {
          const version =
            component.toVersion === null
              ? t('updates.noTarget', { from: component.fromVersion })
              : t('updates.versionChange', {
                  from: component.fromVersion,
                  to: component.toVersion,
                });

          return (
            <AccordionItem key={component.type} value={component.type}>
              <AccordionTrigger className="px-4 py-3">
                <div className="grid flex-1 grid-cols-12 items-center gap-2 text-left">
                  <div className={cn('col-span-8', COLUMNS.name)}>
                    <p className="font-medium">{labels[component.type] ?? component.type}</p>
                    <p className="text-xs font-normal text-copy-muted">
                      {t('updates.uses', { count: component.usageCount })}
                      <span className="sm:hidden">
                        {` · ${version} · ${t('table.pagesCount', { count: component.pageCount })}`}
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn('hidden font-normal text-copy-muted sm:block', COLUMNS.version)}
                  >
                    {version}
                  </span>
                  <span className={cn('hidden font-normal sm:block', COLUMNS.pages)}>
                    {t('table.pagesCount', { count: component.pageCount })}
                  </span>
                  <span
                    className={cn(
                      'col-span-4 justify-self-end sm:justify-self-start',
                      COLUMNS.status,
                    )}
                  >
                    <Badge variant={STATUS_VARIANTS[component.status]}>
                      {t(`updates.status.${component.status}`)}
                    </Badge>
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ComponentDetails component={component} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
