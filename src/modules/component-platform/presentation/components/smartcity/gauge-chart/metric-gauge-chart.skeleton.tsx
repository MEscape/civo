import { Skeleton } from '@components/ui/skeleton';

import { SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricGaugeChartSkeleton() {
  return (
    <SectionSkeleton tone="muted" containerClassName="flex flex-col items-center">
      <Skeleton className="h-56 w-56 rounded-full" />
      <Skeleton className="mt-4 h-4 w-48" />
    </SectionSkeleton>
  );
}
