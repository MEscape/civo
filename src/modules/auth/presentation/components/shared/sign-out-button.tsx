'use client';

import { useState, useTransition } from 'react';

import { Button } from '@components/ui/button';
import type { ButtonProps } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { signOutAction } from '../../actions/sign-out-action';
import { authRoutes } from '../../routes';

export function SignOutButton(props: Pick<ButtonProps, 'variant' | 'className'>) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hasFailed, setHasFailed] = useState(false);
  const label = isPending ? t('signOut.pending') : t('signOut.label');

  function handleClick() {
    setHasFailed(false);
    startTransition(async () => {
      try {
        const result = await signOutAction();
        // A failed sign-out must not look like a successful one: stay put so the user can retry.
        if (!result.ok) {
          setHasFailed(true);
          return;
        }
        // The action revalidated the layout, so the sign-in page is fetched fresh: no extra refresh.
        router.push(authRoutes.signIn());
      } catch {
        setHasFailed(true);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      disabled={isPending}
      aria-busy={isPending}
      // Ends the visit, so a page with unsaved work asks first (`useUnsavedNavigationGuard`).
      data-navigation-guard-leaves=""
      onClick={handleClick}
    >
      {hasFailed ? <span role="alert">{t('signOut.failed')}</span> : label}
    </Button>
  );
}
