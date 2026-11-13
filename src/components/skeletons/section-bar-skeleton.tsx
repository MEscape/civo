import { Skeleton } from '@components/ui/skeleton';

export interface SectionBarSkeletonProps {
  /** How many tabs: what the bar below it has, so the real one does not shift anything when it comes. */
  readonly tabs?: number;
  /** The bar starts with a name (a website, a workspace); the platform's does not. */
  readonly hasName?: boolean;
  /** What the bar has at its far end: the way back to the website, the publish state. */
  readonly hasTrailing?: boolean;
}

/**
 * The bar under the app header while it loads, one for the platform, a website and a booking
 * workspace alike: the name, the tabs and what the bar has at its end, filling the bar's height.
 */
export function SectionBarSkeleton({
  tabs = 5,
  hasName = true,
  hasTrailing = false,
}: SectionBarSkeletonProps) {
  return (
    <div aria-hidden="true" className="flex h-full min-w-0 flex-1 items-center gap-6">
      {hasName && <Skeleton className="h-5 w-36 shrink-0" />}
      {Array.from({ length: tabs }, (_, index) => (
        <Skeleton key={index} className="hidden h-4 w-16 sm:block" />
      ))}
      {hasTrailing && <Skeleton className="ms-auto h-4 w-28" />}
    </div>
  );
}
