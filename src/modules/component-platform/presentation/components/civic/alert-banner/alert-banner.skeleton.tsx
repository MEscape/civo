import { Container } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

export function AlertBannerSkeleton() {
  return (
    <div className="py-4" aria-busy="true">
      <LoadingStatus />
      <Container>
        <Skeleton className="h-14 w-full" />
      </Container>
    </div>
  );
}
