import { Trash2 } from "lucide-react";
import { wasteCalendarPropsSchema } from "./waste-calendar.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Section, Container, SectionHeading } from "@/modules/builder/components/layout/layout-primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger/logger";
import type { WasteType } from "@/modules/content/domain/content-types";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short" });

/**
 * Human-readable German labels for waste types. Exported from this index
 * (not the mock class) since this is domain configuration, not an
 * implementation detail of any specific provider.
 */
export const wasteTypeLabel: Record<WasteType, string> = {
    restmuell: "Restmüll",
    biomuell: "Biomüll",
    papier: "Papier",
    gelberSack: "Gelber Sack",
    sperrmuell: "Sperrmüll",
};

const wasteBadgeVariant: Record<WasteType, "default" | "muted" | "warning"> = {
    restmuell: "muted",
    biomuell: "default",
    papier: "muted",
    gelberSack: "warning",
    sperrmuell: "warning",
};

/**
 * WasteCalendar — Abfuhrkalender. A common, genuinely municipal-specific
 * need (spec: civic composites batch) that no generic list component
 * models well, since it needs date + waste-type + district together with
 * type-specific visual distinction (color-coded badges, as residents
 * expect from real Abfuhrkalender apps/flyers).
 */
export async function WasteCalendar({ props }: { props: Record<string, unknown> }) {
    const parsed = wasteCalendarPropsSchema.safeParse(props);
    const { heading, district, limit } = parsed.success
        ? parsed.data
        : { heading: "Abfuhrkalender", district: undefined, limit: 10 };

    const provider = getCivicDataProvider();
    const result = await provider.getWasteCollectionEntries({ district, from: new Date() });

    if (!result.ok) {
        logger.error("WasteCalendar failed to load entries", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    const entries = result.data.slice(0, limit);

    return (
        <Section tone="muted">
            <Container className="max-w-2xl">
                <SectionHeading>{heading}</SectionHeading>
                <Card>
                    <CardContent className="pt-5">
                        <ul className="flex flex-col divide-y divide-[var(--civo-color-border)]">
                            {entries.map((entry) => (
                                <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                    <div className="flex items-center gap-3">
                                        <Trash2 className="h-4 w-4 shrink-0 text-[var(--civo-color-text-muted)]" aria-hidden="true" />
                                        <div>
                                            <p className="text-[var(--civo-color-text)]">{dateFormatter.format(entry.date)}</p>
                                            {entry.district && (
                                                <p className="text-xs text-[var(--civo-color-text-muted)]">{entry.district}</p>
                                            )}
                                        </div>
                                    </div>
                                    <Badge variant={wasteBadgeVariant[entry.wasteType]}>
                                        {wasteTypeLabel[entry.wasteType]}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </Container>
        </Section>
    );
}
