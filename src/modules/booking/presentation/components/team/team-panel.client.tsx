'use client';

import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { usePagedList } from '../../hooks/use-paged-list';
import { bookingRoutes } from '../../routes';
import { ListSearch } from '../shared/list-search';

import { StaffHoursPolicy } from './staff-hours-policy.client';
import { TeamMemberCard } from './team-member-card.client';

import type { TeamDto } from '../../dto/setup-dto';

export interface TeamPanelProps {
  readonly websiteId: string;
  readonly team: TeamDto;
}

/**
 * The employees and their weeks, for those who run the bookings. People set up
 * their own calendar (their name, where they work, which services they offer);
 * this is where their hours can be seen next to each other and set when needed,
 * for one person or for everyone at once.
 */
export function TeamPanel({ websiteId, team }: TeamPanelProps) {
  const t = useTranslations('booking');
  const list = usePagedList(team.members, { label: (member) => member.name });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-copy">{t('team.title')}</h2>
        <p className="text-sm text-copy-muted">{t('team.intro')}</p>
      </div>
      {team.locations.length > 0 && (
        <section aria-labelledby="staff-hours-title" className="space-y-3">
          <div>
            <h3 id="staff-hours-title" className="text-base font-medium text-copy">
              {t('team.policy.title')}
            </h3>
            <p className="text-sm text-copy-muted">{t('team.policy.intro')}</p>
          </div>
          <div className="space-y-2">
            {team.locations.map((location) => (
              <StaffHoursPolicy
                key={location.id}
                websiteId={websiteId}
                location={location}
                members={team.members}
              />
            ))}
          </div>
        </section>
      )}
      {team.members.length === 0 ? (
        <div className="space-y-2 rounded-token border border-dashed border-border-strong bg-canvas p-8 text-center">
          <h3 className="text-base font-medium text-copy">{t('team.empty.title')}</h3>
          <p className="mx-auto max-w-prose text-sm text-copy-muted">
            {t('team.empty.description')}
          </p>
          <Link
            href={bookingRoutes.inviteEmployee(websiteId)}
            className="text-sm font-medium text-primary-copy underline underline-offset-4"
          >
            {t('team.empty.action')}
          </Link>
        </div>
      ) : (
        <>
          {list.isSearchable && (
            <ListSearch id="team-search" value={list.query} onChange={list.setQuery} />
          )}
          <ul className="space-y-3">
            {list.shown.map((member) => (
              <TeamMemberCard
                key={member.id}
                websiteId={websiteId}
                member={member}
                locations={team.locations}
                services={team.services}
                colleagueIds={team.members
                  .filter((colleague) => colleague.id !== member.id)
                  .map((colleague) => colleague.id)}
              />
            ))}
          </ul>
          {list.hasNoMatch && (
            <p role="status" className="text-sm text-copy-muted">
              {t('form.noMatches')}
            </p>
          )}
          {list.hiddenCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={list.showMore}>
              {t('list.showMore', { count: list.hiddenCount })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
