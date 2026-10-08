import { Skeleton } from '@components/ui/skeleton';

import { SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricDonutChartSkeleton() {
  return (
    <SectionSkeleton containerClassName="max-w-2xl">
      <div className="flex h-72 items-center justify-center">
        <Skeleton className="h-56 w-56 rounded-full" />
      </div>
    </SectionSkeleton>
  );
}
