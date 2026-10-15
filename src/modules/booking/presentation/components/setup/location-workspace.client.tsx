'use client';

import { useState } from 'react';

import { Badge } from '@components/ui/badge';
import { Button, buttonVariants } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { Link, useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { deleteLocationAction } from '../../actions/delete-location-action';
import { planFormOf } from '../../drafts/availability-plan-form';
import { isOutside } from '../../drafts/hours-conflicts';
import { bookingRoutes } from '../../routes';
import { LocationForm } from '../admin/location-form.client';
import { DeleteEntityButton } from '../shared/delete-entity-button';

import { OpeningHoursSection } from './opening-hours-section.client';
import { WorkspaceResources } from './workspace-resources.client';
import { WorkspaceServices } from './workspace-services.client';

import type { BookingOptionsDto, LocationWorkspaceDto } from '../../dto/setup-dto';

export interface LocationWorkspaceProps {
  readonly workspace: LocationWorkspaceDto;
  readonly options: BookingOptionsDto;
  readonly canConfigure: boolean;
}

/**
 * Everything about one location in one place, top to bottom in the order it is
 * set up: when it is open, the rooms and equipment there, and the services
 * that use them. Opening hours frame the rest, so they come first; a service
 * can only ask for what already exists, so the resources come before it.
 */
export function LocationWorkspace({ workspace, options, canConfigure }: LocationWorkspaceProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const { location } = workspace;
  const [isEditing, setIsEditing] = useState(false);
  const [hoursDraft, setHoursDraft] = useState(() => planFormOf(location.openingHours));

  // What would be open while the place is closed, once the hours being edited are saved.
  const conflicting = [
    ...workspace.services.map(({ service }) => service),
    ...workspace.resources,
  ].filter((entry) =>
    isOutside(entry.availability && planFormOf(entry.availability).weekly, hoursDraft.weekly),
  );
  const conflictIds: ReadonlySet<string> = new Set(conflicting.map((entry) => entry.id));

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Link
          href={`${bookingRoutes.admin(location.websiteId)}?tab=setup`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
        >
          <Icons.chevronRight className="size-4 rotate-180" aria-hidden="true" />
          {t('workspace.back')}
        </Link>
        {isEditing ? (
          <div className="rounded-token border border-border bg-surface p-4">
            <LocationForm
              websiteId={location.websiteId}
              location={location}
              onSaved={() => {
                setIsEditing(false);
              }}
              onCancel={() => {
                setIsEditing(false);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-semibold text-copy">{location.name}</h2>
              <p className="text-sm text-copy-muted">
                {location.address ?? t('location.virtual')} · {location.timeZone}
              </p>
              {!location.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
            </div>
            {canConfigure && (
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                  }}
                >
                  {t('workspace.editDetails')}
                </Button>
                <DeleteEntityButton
                  kind="location"
                  name={location.name}
                  onDelete={() =>
                    deleteLocationAction({ websiteId: location.websiteId, id: location.id })
                  }
                  onDeleted={() => {
                    router.push(`${bookingRoutes.admin(location.websiteId)}?tab=setup`);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </header>

      <OpeningHoursSection
        location={location}
        canConfigure={canConfigure}
        draft={hoursDraft}
        onDraftChange={setHoursDraft}
        conflicts={conflicting.map((entry) => entry.name)}
      />
      <WorkspaceResources
        location={location}
        resources={workspace.resources}
        options={options}
        canConfigure={canConfigure}
        conflictIds={conflictIds}
      />
      <WorkspaceServices
        location={location}
        entries={workspace.services}
        resources={workspace.resources}
        otherServices={workspace.otherServices}
        options={options}
        canConfigure={canConfigure}
        conflictIds={conflictIds}
      />
    </div>
  );
}
