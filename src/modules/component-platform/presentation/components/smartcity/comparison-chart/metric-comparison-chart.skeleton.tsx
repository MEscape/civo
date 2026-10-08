import { ChartSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricComparisonChartSkeleton() {
  return (
    <SectionSkeleton>
      <ChartSkeleton className="h-80" />
    </SectionSkeleton>
  );
}
