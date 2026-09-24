import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Section, Container } from "@/components/layout/layout-primitives";

export function ServiceGridSkeleton() {
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Card key={i}>
                            <CardContent className="space-y-3 pt-5">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-7 w-1/3" />
                                <Skeleton className="h-3 w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </Container>
        </Section>
    );
}
