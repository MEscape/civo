import { Skeleton } from "@/components/ui/skeleton";
import { Section, Container } from "@/components/layout/layout-primitives";

export function MetricTableSkeleton() {
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
            </Container>
        </Section>
    );
}
