'use client';

import { ChevronRight, MoreHorizontal, Trash2 } from '@components/icons/icons';
import { Button, buttonVariants } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useTeamMembership } from '../../hooks/use-team-membership';

import { MembershipDialogs } from './membership-dialogs.client';

import type { LocationNameDto } from '../../dto/service-dto';
import type { MembershipSubject } from '../../hooks/use-team-membership';

export interface TeamRowActionsProps {
  readonly subject: MembershipSubject;
  /** Where "Edit" leads: the person's calendar. */
  readonly editHref: string;
  /** The other locations a person can be moved to. */
  readonly moveTargets: readonly LocationNameDto[];
}

/**
 * What a manager does with a person from their row in the team: open the calendar, or use the menu
 * (move, remove) that is two buttons at the top of the person's page, so nothing has to be opened first.
 */
export function TeamRowActions({ subject, editHref, moveTargets }: TeamRowActionsProps) {
  const t = useTranslations('booking');
  const membership = useTeamMembership(subject);

  return (
    <div className="flex justify-end gap-1">
      <Link
        href={editHref}
        aria-label={t('team.list.editNamed', { name: subject.name })}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        {t('team.list.edit')}
        <ChevronRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('team.list.moreNamed', { name: subject.name })}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={moveTargets.length === 0}
            onSelect={() => {
              membership.start('move');
            }}
          >
            {t('team.membership.move')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger"
            onSelect={() => {
              membership.start('remove');
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t('team.membership.remove')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MembershipDialogs subject={subject} choices={moveTargets} membership={membership} />
    </div>
  );
}
