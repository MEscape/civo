import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MessagesAdministration } from '@modules/booking';

import { BookingPageSkeleton } from '@components/skeletons/booking-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('employee.messages.title'));
}

async function MessagesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <MessagesAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function MessagesPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingPageSkeleton variant="messages" hasFilters={false} />}>
      <MessagesContent {...props} />
    </Suspense>
  );
}
