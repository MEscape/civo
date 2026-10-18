import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import {
  AcceptInvitationForm,
  InvitationLinkInvalid,
  InvitationLinkMissing,
  getAuthQueries,
  isAuthEnabled,
  parseAcceptInvitationPageParams,
} from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { AuthFormSkeleton } from '@/app/_lib/auth-form-skeleton';
import { loadInvitedOrganisation } from '@/app/_lib/invited-organisation';
import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  // Reached only through a single-use emailed link: never indexed.
  return buildPrivateMetadata(t('acceptInvitation.metadata.title'));
}

async function AcceptInvitationContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  const { token } = parseAcceptInvitationPageParams(await searchParams);
  if (token === undefined) {
    return <InvitationLinkMissing />;
  }
  // The database driver draws random ids, which a prerender may not do: this read belongs to the request.
  await connection();
  // The link is read before the form is drawn, so a used or expired one says so at once, not after a password is typed.
  const invitation = await orFail(getAuthQueries().previewInvitation.execute(token));
  if (invitation === null) {
    return <InvitationLinkInvalid />;
  }
  return (
    <AcceptInvitationForm
      token={token}
      invitation={{
        email: invitation.email,
        role: invitation.role,
        organisation: await loadInvitedOrganisation(invitation.tenantId),
        expiresAt: invitation.expiresAt.toISOString(),
      }}
    />
  );
}

export default function AcceptInvitationPage({ searchParams }: RouteProps) {
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <AcceptInvitationContent searchParams={searchParams} />
    </Suspense>
  );
}
