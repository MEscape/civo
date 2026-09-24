import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Section, Container } from "@/components/layout/layout-primitives";

/**
 * A rough shape for whichever data widget is streaming in, keyed by
 * component type. Deliberately approximate — matching the eventual layout
 * exactly would mean a second implementation per widget to keep in sync —
 * the goal is only to avoid a layout jump and a blank gap while data loads.
 * Unlisted types fall back to a generic card grid, which fits most widgets.
 */
export function WidgetSkeleton({ type }: { type: string }) {
    if (SKELETONS[type]) {
        const Body = SKELETONS[type];
        return (
            <Section>
                <Container>
                    <Skeleton className="mb-6 h-7 w-56" />
                    <Body />
                </Container>
            </Section>
        );
    }
    return (
        <Section>
            <Container>
                <Skeleton className="mb-6 h-7 w-56" />
                <CardGrid count={3} />
            </Container>
        </Section>
    );
}

function CardGrid({ count }: { count: number }) {
    return (
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {Array.from({ length: count }, (_, i) => (
                <Card key={i}>
                    <CardContent className="space-y-3 pt-5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-7 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function ChartBody() {
    return (
        <Card>
            <CardContent className="pt-5">
                <Skeleton className="h-72 w-full" />
            </CardContent>
        </Card>
    );
}

function TableBody() {
    return (
        <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
            ))}
        </div>
    );
}

function ListBody() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
            ))}
        </div>
    );
}

export const SKELETONS: Record<string, () => React.ReactElement> = {
    kpiGrid: () => <CardGrid count={6} />,
    dashboardGrid: () => <CardGrid count={6} />,
    metricChart: ChartBody,
    metricComparisonChart: ChartBody,
    metricTrendChart: ChartBody,
    metricDonut: ChartBody,
    metricGauge: () => (
        <div className="flex justify-center">
            <Skeleton className="size-56 rounded-full" />
        </div>
    ),
    metricTable: TableBody,
    newsGrid: () => <CardGrid count={3} />,
    eventsGrid: () => <CardGrid count={3} />,
    serviceGrid: () => <CardGrid count={4} />,
    newsAndEventsSplit: () => (
        <div className="grid grid-cols-1 gap-10 @5xl:grid-cols-2">
            <ListBody />
            <ListBody />
        </div>
    ),
    contactCard: () => <CardGrid count={3} />,
    departmentDirectory: ListBody,
    councilBlock: ListBody,
    openingHours: ListBody,
    wasteCalendar: TableBody,
    serviceFinder: ListBody,
};
