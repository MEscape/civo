'use client';

import { ChevronDown, Pencil } from '@components/icons/icons';
import { Button } from '@components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { authRoutes } from '../../routes';
import { SignOutButton } from '../shared/sign-out-button';

import { ProfileAvatar } from './profile-avatar';

import type { ProfileView } from '../../../application/contracts/profile-views';

export function AccountMenu({ profile }: { readonly profile: ProfileView }) {
  const t = useTranslations('auth');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto gap-2 rounded-full p-1"
          aria-label={t('profile.menu')}
        >
          <ProfileAvatar name={profile.name} image={profile.image} />
          <ChevronDown className="mr-1 size-3.5 text-copy-muted" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="max-w-64 truncate font-medium">{profile.name}</p>
          <p className="max-w-64 truncate text-xs text-copy-muted">{profile.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={authRoutes.profile()}>
            <Pencil className="size-4" aria-hidden="true" />
            {t('profile.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          onSelect={(event) => {
            event.preventDefault();
          }}
        >
          <SignOutButton variant="ghost" className="h-auto w-full justify-start px-3 py-2" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
