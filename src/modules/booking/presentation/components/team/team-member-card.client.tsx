'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { planFormOf } from '../../drafts/availability-plan-form';

import { TeamMemberHours } from './team-member-hours.client';
import { TeamMemberServices } from './team-member-services.client';

import type { TeamDto, TeamMemberDto } from '../../dto/setup-dto';

export interface TeamMemberCardProps {
  readonly websiteId: string;
  readonly member: TeamMemberDto;
  readonly locations: TeamDto['locations'];
  readonly services: TeamDto['services'];
  /** Everyone else on the team: "the same hours for everyone" reaches them. */
  readonly colleagueIds: readonly string[];
}

/**
 * One employee, opened to their week and the services they offer. Both are
 * set by a manager when needed and the employee is told about it; their name
 * and location are theirs and are not changed here.
 */
export function TeamMemberCard({
  websiteId,
  member,
  locations,
  services,
  colleagueIds,
}: TeamMemberCardProps) {
  const t = useTranslations('booking');
  const location = locations.find((candidate) => candidate.id === member.locationId);

  return (
    <li>
      <details className="group/card rounded-token border border-border bg-surface">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-token px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-copy">{member.name}</span>
            <Badge variant="outline">{location?.name ?? t('team.noLocation')}</Badge>
            {!member.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
          </span>
          <span className="text-xs text-copy-muted">
            {member.availability === null ? t('team.followsLocation') : t('team.ownHours')}
            {' · '}
            {t('team.offers', { count: member.offeredServiceIds.length })}
          </span>
        </summary>
        <div className="space-y-6 border-t border-border p-4">
          {location === undefined ? (
            <p role="status" className="text-sm text-warning">
              {t('team.noLocationHint')}
            </p>
          ) : (
            <>
              <TeamMemberHours
                websiteId={websiteId}
                member={member}
                frameWeek={planFormOf(location.employeeHours).weekly}
                hasStaffHours={location.staffHours !== null}
                colleagueIds={colleagueIds}
              />
              <TeamMemberServices websiteId={websiteId} member={member} services={services} />
            </>
          )}
        </div>
      </details>
    </li>
  );
}
