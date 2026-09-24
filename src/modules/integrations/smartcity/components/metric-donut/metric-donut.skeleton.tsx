import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Section, Container } from "@/components/layout/layout-primitives";

export function MetricDonutSkeleton() {
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <Card>
                    <CardContent className="pt-5">
                        <Skeleton className="h-72 w-full" />
                    </CardContent>
                </Card>
            </Container>
        </Section>
    );
}
