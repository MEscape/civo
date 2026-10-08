import { CardGridSkeleton, SectionSkeleton } from '../../shared/skeleton-blocks';

export function DepartmentDirectorySkeleton() {
  return (
    <SectionSkeleton>
      <CardGridSkeleton columns={2} count={4} />
    </SectionSkeleton>
  );
}
