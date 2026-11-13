import { Skeleton } from '@components/ui/skeleton';

export interface RenderSkeletonProps {
  /** Said once to assistive technology; the blocks themselves are decorative. */
  readonly label: string;
  /** The popover's small stage needs fewer, smaller blocks than the canvas. */
  readonly isCompact?: boolean;
  readonly className?: string;
}

/**
 * What the canvas and the component preview show while the server renders a draft: blocks where
 * the content will be, instead of a line of text, so nothing jumps when it arrives.
 */
export function RenderSkeleton({ label, isCompact = false, className }: RenderSkeletonProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3 p-4">
        <Skeleton className={isCompact ? 'h-16 w-full' : 'h-32 w-full'} />
        <Skeleton className={isCompact ? 'h-10 w-2/3' : 'h-24 w-2/3'} />
        {!isCompact && <Skeleton className="h-24 w-full" />}
      </div>
    </div>
  );
}
