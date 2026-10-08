import { ChartSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function MetricChartSkeleton() {
  return (
    <SectionSkeleton tone="muted">
      <ChartSkeleton />
    </SectionSkeleton>
  );
}
