import { AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { alertBannerPropsSchema } from "./alert-banner.definition";
import { getCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters";
import { Container } from "@/modules/builder/components/layout/layout-primitives";
import { logger } from "@/lib/logger/logger";
import type { AlertSeverity } from "@/modules/content/domain/content-types";

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

// Intentionally not theme tokens: severity color is a fixed semantic
// signal (danger/warning/info) that must stay legible regardless of a
// municipality's brand palette — the one deliberate exception to
// "everything through --civo tokens", scoped to this component only.
const severityClasses: Record<AlertSeverity, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    urgent: "border-red-200 bg-red-50 text-red-900",
};

export async function AlertBanner({ props }: { props: Record<string, unknown> }) {
    const parsed = alertBannerPropsSchema.safeParse(props);
    const { heading, activeOnly, limit } = parsed.success
        ? parsed.data
        : { heading: undefined, activeOnly: true, limit: 3 };

    const provider = getCivicDataProvider();
    const result = await provider.getAlerts({ activeOnly });

    if (!result.ok) {
        logger.error("AlertBanner failed to load alerts", { error: result.error });
        return null;
    }
    if (result.data.length === 0) return null;

    const alerts = result.data.slice(0, limit);

    return (
        <div style={{ paddingBlock: "calc(var(--civo-section-spacing) * 0.4)" }}>
            <Container className="flex flex-col gap-3">
                {heading && (
                    <h2 className="font-[family-name:var(--civo-font-heading)] text-lg text-[var(--civo-color-text)]">
                        {heading}
                    </h2>
                )}
                {alerts.map((alert) => {
                    const Icon = severityIcon[alert.severity];
                    return (
                        <div
                            key={alert.id}
                            role={alert.severity === "urgent" ? "alert" : "status"}
                            className={`flex items-start gap-3 rounded-[var(--civo-radius)] border px-4 py-3 text-sm ${severityClasses[alert.severity]}`}
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
