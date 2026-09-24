import { Skeleton } from "@/components/ui/skeleton";
import { Section, Container } from "@/components/layout/layout-primitives";

export function NewsAndEventsSplitSkeleton() {
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <div className="grid grid-cols-1 gap-10 @5xl:grid-cols-2">
                    <div className="space-y-3">
                        {Array.from({ length: 4 }, (_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                    <div className="space-y-3">
                        {Array.from({ length: 4 }, (_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                </div>
            </Container>
        </Section>
    );
}
