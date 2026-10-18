import { Skeleton } from '@components/ui/skeleton';

/** Each block streams in on its own, so a slow read never holds back the others. */
export function BlockSkeleton({ className }: { readonly className?: string }) {
  return <Skeleton aria-hidden="true" className={className ?? 'h-40 w-full'} />;
}
