'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { useTranslations } from '@i18n/client';

import { LocationsPanel } from './locations-panel';
import { OperationsCalendar } from './operations-calendar.client';
import { ResourcesPanel } from './resources-panel';
import { ServicesPanel } from './services-panel';

import type { BookingSetupDto, EmployeeOptionDto } from '../../dto/setup-dto';

export interface BookingAdminProps {
  readonly websiteId: string;
  readonly setup: BookingSetupDto;
  readonly canConfigure: boolean;
  readonly canManage: boolean;
  readonly employees: readonly EmployeeOptionDto[];
}

/**
 * The administration screen: the operations calendar first, because that is
 * what staff open it for, then services, resources and locations. Entries a
 * person may not change are listed read-only.
 */
export function BookingAdmin({
  websiteId,
  setup,
  canConfigure,
  canManage,
  employees,
}: BookingAdminProps) {
  const t = useTranslations('booking');

  return (
    <Tabs defaultValue="calendar" className="space-y-4">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="calendar">{t('admin.tabs.calendar')}</TabsTrigger>
        <TabsTrigger value="services">{t('admin.tabs.services')}</TabsTrigger>
        <TabsTrigger value="resources">{t('admin.tabs.resources')}</TabsTrigger>
        <TabsTrigger value="locations">{t('admin.tabs.locations')}</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar">
        <OperationsCalendar websiteId={websiteId} setup={setup} canManage={canManage} />
      </TabsContent>
      <TabsContent value="services">
        <ServicesPanel websiteId={websiteId} setup={setup} canConfigure={canConfigure} />
      </TabsContent>
      <TabsContent value="resources">
        <ResourcesPanel
          websiteId={websiteId}
          setup={setup}
          canConfigure={canConfigure}
          employees={employees}
        />
      </TabsContent>
      <TabsContent value="locations">
        <LocationsPanel websiteId={websiteId} setup={setup} canConfigure={canConfigure} />
      </TabsContent>
    </Tabs>
  );
}
