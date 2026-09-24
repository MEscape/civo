import { Skeleton } from "@/components/ui/skeleton";
import { Section, Container } from "@/components/layout/layout-primitives";

export function MetricGaugeSkeleton() {
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <div className="flex justify-center">
                    <Skeleton className="size-56 rounded-full" />
                </div>
            </Container>
        </Section>
    );
}
