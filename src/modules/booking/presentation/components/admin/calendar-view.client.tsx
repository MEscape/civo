'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@components/ui/skeleton';

/**
 * The calendar library is large and only the operations screen needs it, so
 * it loads on demand and never on the server (it measures the DOM).
 */
export const CalendarView = dynamic(
  () => import('./calendar-adapter.client').then((module) => module.CalendarAdapter),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full" />,
  },
);
