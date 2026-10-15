import { Container, Section } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/loading-status';
import { Skeleton } from '@components/ui/skeleton';

/**
 * The placeholder of a sign-in style page while its data streams in: a
 * heading and a form in the narrow column these pages use. It is both the
 * route's `loading.tsx` and the Suspense fallback of every page that reads
 * request data (Cache Components needs a real placeholder at each boundary).
 */
export function AuthFormSkeleton() {
  return (
    <Container className="max-w-md">
      <Section className="space-y-8" aria-busy="true">
        <LoadingStatus />
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-4" aria-hidden="true">
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
