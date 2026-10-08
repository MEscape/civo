import { ChartSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricTrendChartSkeleton() {
  return (
    <SectionSkeleton tone="muted">
      <ChartSkeleton />
    </SectionSkeleton>
  );
}
