import { Container, Section } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

export function MapBlockSkeleton() {
  return (
    <Section aria-busy="true">
      <LoadingStatus />
      <Container>
        <Skeleton className="mb-6 h-8 w-1/3" />
        <Skeleton className="h-96 w-full" />
      </Container>
    </Section>
  );
}
