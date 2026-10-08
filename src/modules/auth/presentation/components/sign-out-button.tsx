'use client';

import { useTransition } from 'react';

import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { signOutAction } from '../actions/sign-out-action';
import { authRoutes } from '../routes';

export function SignOutButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await signOutAction();
      // A failed sign-out must not look like a successful one: stay put so the user can retry.
      if (!result.ok) {
        return;
      }
      router.push(authRoutes.signIn());
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      aria-busy={isPending}
      onClick={handleClick}
    >
      {isPending ? t('signOut.pending') : t('signOut.label')}
    </Button>
  );
}
