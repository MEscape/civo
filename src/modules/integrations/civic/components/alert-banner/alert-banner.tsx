import { AlertTriangle, Info, AlertOctagon } from "@/components/ui/icons";
import { alertBannerPropsSchema } from "./alert-banner.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Container } from "@/components/layout/layout-primitives";
import { WidgetState } from "@/components/layout/widget-state";
import { logger } from "@/lib/logger/logger";
import type { AlertSeverity } from "@/modules/content/domain/civic-types";
import { PreviewStatusBadge } from "@/modules/builder/components/preview-status-badge";

/**
 * AlertBanner — official notices / Bekanntmachungen (spec: civic
 * composites batch). Deliberately NOT a Section like most other
 * components: alerts read as site-level notices, so this renders with
 * tighter vertical rhythm than the standard --civo-section-spacing,
 * while still only using theme tokens (no one-off colors) so admin
 * theme changes apply uniformly here too.
 */
const severityIcon: Record<AlertSeverity, typeof Info> = {
    info: Info,
    warning: AlertTriangle,
    urgent: AlertOctagon,
};

// Severity uses the static status tokens (never the brand palette), so a
// notice stays legible and means the same thing on every municipality's
// site. Meaning is carried by the icon and role as well as color.
const severityClasses: Record<AlertSeverity, string> = {
    info: "border-info-border bg-info-subtle text-info",
    warning: "border-warning-border bg-warning-subtle text-warning",
    urgent: "border-danger-border bg-danger-subtle text-danger",
};

export async function AlertBanner({ props, editMode }: { props: Record<string, unknown>; editMode?: boolean }) {
    const parsed = alertBannerPropsSchema.safeParse(props);
    const { heading, activeOnly, limit, datasetId } = parsed.success
        ? parsed.data
        : { heading: undefined, activeOnly: true, limit: 3, datasetId: undefined };

    const provider = await getCivicDataProvider(datasetId, editMode);
    const result = await provider.getAlerts({ activeOnly });

    if (!result.ok) {
        logger.error("AlertBanner failed to load alerts", { error: result.error });
        // Unlike the other widgets, a MISSING heading is common here (most
        // placements show no heading at all), so the error state needs its
        // own fallback title rather than silently rendering an unlabelled
        // WidgetState. An empty result is NOT an error: no active alerts is
        // the normal, common case, and showing a banner that says "no
        // alerts" on every quiet day would be noise, not information.
        return <WidgetState kind="error" heading={heading ?? "Aktuelle Hinweise"} />;
    }
    if (result.data.length === 0) return null;

    const alerts = result.data.slice(0, limit);

    return (
        <div style={{ paddingBlock: "calc(var(--civo-section-spacing) * 0.4)" }} className="relative">
            {editMode && <PreviewStatusBadge datasetId={datasetId} />}
            <Container className="flex flex-col gap-3">
                {heading && (
                    <h2 className="font-heading text-lg text-copy">
                        {heading}
                    </h2>
                )}
                {alerts.map((alert) => {
                    const Icon = severityIcon[alert.severity];
                    return (
                        <div
                            key={alert.id}
                            role={alert.severity === "urgent" ? "alert" : "status"}
                            className={`flex items-start gap-3 rounded-token border px-4 py-3 text-sm ${severityClasses[alert.severity]}`}
                        >
                            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <div>
                                <p className="font-medium">
                                    {alert.href ? (
                                        <a href={alert.href} className="hover:underline">
                                            {alert.title}
                                        </a>
                                    ) : (
                                        alert.title
                                    )}
                                </p>
                                {alert.message && <p className="mt-0.5 opacity-90">{alert.message}</p>}
                            </div>
                        </div>
                    );
                })}
            </Container>
        </div>
    );
}
