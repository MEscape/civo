import { PageSkeleton } from '@components/shared/page-skeleton';

/**
 * The placeholder every admin page shows while its data streams in. Cache
 * Components requires a real placeholder at each dynamic boundary, and this
 * file is that boundary for the whole group.
 */
export default function Loading() {
  return <PageSkeleton />;
}
