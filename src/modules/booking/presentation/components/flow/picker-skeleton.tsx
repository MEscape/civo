import { Skeleton } from '@components/ui/skeleton';

export function PickerSkeleton({ label }: { readonly label: string }) {
  return (
    <div aria-busy="true" className="space-y-2">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
