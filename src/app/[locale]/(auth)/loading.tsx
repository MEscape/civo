import { Container, Section } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

export default function AuthLoading() {
  return (
    <Container className="max-w-md">
      <Section className="space-y-8" aria-busy="true">
        <LoadingStatus />
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </Section>
    </Container>
  );
}
