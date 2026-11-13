'use client';

import { ResponsiveTable } from '@components/shared/responsive-table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { groupKey, useOpenGroups } from '../../hooks/use-open-groups';

import { serviceColumns } from './service-row';

import type { ServiceGroupDto } from '../../dto/service-dto';

export interface ServiceGroupsProps {
  readonly websiteId: string;
  readonly locationId: string;
  readonly groups: readonly ServiceGroupDto[];
  readonly listOrigin?: string | undefined;
}

/**
 * The services of the page as collapsible categories. Each category is a button that says whether it
 * is expanded (`aria-expanded`), and one button opens or closes them all. Which are open is only a
 * view: nothing is stored.
 */
export function ServiceGroups({ websiteId, locationId, groups, listOrigin }: ServiceGroupsProps) {
  const t = useTranslations('booking');
  const { open, setOpen, isAllOpen, toggleAll } = useOpenGroups(groups);

  return (
    <div>
      <div className="flex justify-end border-b border-border px-4 py-2">
        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
          {isAllOpen ? t('services.list.collapseAll') : t('services.list.expandAll')}
        </Button>
      </div>
      <Accordion type="multiple" value={open} onValueChange={setOpen}>
        {groups.map((group) => (
          <AccordionItem key={groupKey(group)} value={groupKey(group)}>
            <AccordionTrigger className="bg-canvas px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-2 pe-3 text-left">
                <span className="min-w-0 text-sm font-semibold text-copy [overflow-wrap:anywhere]">
                  {group.category ?? t('services.list.noCategory')}
                </span>
                <span className="text-xs font-normal text-copy-muted">
                  {t('services.list.groupCount', { count: group.items.length })}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <ResponsiveTable
                label={group.category ?? t('services.list.noCategory')}
                rows={group.items}
                rowKey={(service) => service.id}
                columns={serviceColumns({ t, websiteId, locationId, listOrigin })}
                state={{ kind: 'ready', empty: null }}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
