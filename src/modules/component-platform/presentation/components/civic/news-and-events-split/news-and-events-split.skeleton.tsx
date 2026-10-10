import { Skeleton } from '@components/ui/skeleton';

import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function NewsAndEventsSplitSkeleton() {
  return (
    <SectionSkeleton>
      <div className="@container">
        <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-24" />
            <CardGridSkeleton columns={1} count={3} />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-24" />
            <CardGridSkeleton columns={1} count={3} />
          </div>
        </div>
      </div>
    </SectionSkeleton>
  );
}
