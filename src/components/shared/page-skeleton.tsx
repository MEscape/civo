import { Container, Section } from '@components/layout/layout-primitives';
import { Skeleton } from '@components/ui/skeleton';

import { LoadingStatus } from './loading-status';

/**
 * The placeholder of an admin page while its data streams in: a heading and
 * a few blocks in the shape of the usual page. Cache Components needs a real
 * placeholder at every dynamic boundary (an empty `null` counts as none), and
 * a visible one keeps navigation feeling instant.
 */
export function PageSkeleton() {
  return (
    <Container className="max-w-4xl" aria-busy="true">
      <Section className="space-y-8">
        <LoadingStatus />
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Section>
    </Container>
  );
}
