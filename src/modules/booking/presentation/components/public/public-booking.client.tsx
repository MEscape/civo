'use client';

import { useState } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { Alert } from '@components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { useTranslations } from '@i18n/client';

import { useLinkedReference } from '../../hooks/use-linked-reference';

import { BookingJourney } from './booking-journey.client';
import { ManageBooking } from './manage-booking.client';

import type { JourneyInput } from '../../hooks/use-booking-journey';

const VIEWS = ['book', 'manage'] as const;
type View = (typeof VIEWS)[number];

function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/**
 * What the `booking` component shows a visitor: booking an appointment, or "my booking" to see,
 * move or cancel one. A link from a booking message opens "my booking" with its number filled in.
 * Both panels stay mounted (`forceMount`; Radix sets `data-state`, the class hides the inactive
 * one), so switching back and forth keeps what was chosen and typed.
 */
export function PublicBooking(input: JourneyInput) {
  const t = useTranslations('booking');
  const linkedReference = useLinkedReference();
  const [chosen, setChosen] = useState<View | null>(null);
  const isPreview = input.isPreview === true;
  const view = isPreview ? 'book' : (chosen ?? (linkedReference === undefined ? 'book' : 'manage'));

  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        if (isView(next)) {
          setChosen(next);
        }
      }}
      className="space-y-6"
    >
      {isPreview && (
        <Alert variant="info" role="status">
          {t('public.preview.notice')}
        </Alert>
      )}
      {!isPreview && (
        <TabsList
          aria-label={t('public.views.label')}
          className="h-auto max-w-full flex-wrap justify-start"
        >
          {VIEWS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              className="min-h-11 whitespace-normal [overflow-wrap:anywhere]"
            >
              {t(`public.views.${option}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <TabsContent value="book" forceMount className="mt-0 data-[state=inactive]:hidden">
        {input.catalog.services.length === 0 ? (
          <EmptyState
            variant="outlined"
            title={t('public.empty.title')}
            description={t('public.empty.description')}
          />
        ) : (
          <BookingJourney {...input} />
        )}
      </TabsContent>
      {!isPreview && (
        <TabsContent value="manage" forceMount className="mt-0 data-[state=inactive]:hidden">
          <ManageBooking
            key={linkedReference ?? ''}
            websiteId={input.websiteId}
            catalog={input.catalog}
            initialReference={linkedReference}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
