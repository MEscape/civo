import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { Badge } from '@components/ui/badge';

import { ProfileAvatar } from '../profile/profile-avatar';

import { sortableColumn } from './sortable-column';

import type { UserSorting } from './sortable-column';

interface UserIdentity {
  readonly id: string;
  readonly name: string;
  readonly image?: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly isPlatformAdmin?: boolean;
}

interface IdentityColumnsInput extends UserSorting {
  readonly selfId: string;
  readonly labels: {
    readonly name: string;
    readonly email: string;
    readonly you: string;
    readonly unverified: string;
    readonly platformAdmin?: string;
  };
}

/** Identity columns stay identical across website and platform access management. */
export function userIdentityColumns<Row extends UserIdentity>({
  selfId,
  labels,
  ...sorting
}: IdentityColumnsInput): ReadonlyArray<ResponsiveColumn<Row>> {
  return [
    {
      id: 'name',
      label: labels.name,
      width: '@3xl:w-1/4',
      ...sortableColumn(sorting, 'name', labels.name),
      cell: (user) => (
        <div className="flex items-center gap-3 font-medium text-copy">
          <ProfileAvatar name={user.name} image={user.image ?? null} />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span>{user.name}</span>
            {(user.id === selfId || (user.isPlatformAdmin && labels.platformAdmin)) && (
              <span className="flex flex-wrap gap-1">
                {user.id === selfId && <Badge variant="muted">{labels.you}</Badge>}
                {user.isPlatformAdmin && labels.platformAdmin && (
                  <Badge variant="muted" className="whitespace-nowrap">
                    {labels.platformAdmin}
                  </Badge>
                )}
              </span>
            )}
          </span>
        </div>
      ),
    },
    {
      id: 'email',
      label: labels.email,
      width: '@3xl:w-1/4',
      ...sortableColumn(sorting, 'email', labels.email),
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-1.5 text-copy-muted">
          <span>{user.email}</span>
          {!user.emailVerified && <Badge variant="warning">{labels.unverified}</Badge>}
        </span>
      ),
    },
  ];
}
