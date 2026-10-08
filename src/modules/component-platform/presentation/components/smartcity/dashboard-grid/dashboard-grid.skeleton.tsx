import { Card, CardContent } from '@components/ui/card';

import { CardGridSkeleton, ChartSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function DashboardGridSkeleton() {
  return (
    <SectionSkeleton>
      <CardGridSkeleton columns={4} />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <ChartSkeleton />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <ChartSkeleton />
          </CardContent>
        </Card>
      </div>
    </SectionSkeleton>
  );
}
