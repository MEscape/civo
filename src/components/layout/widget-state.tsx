import { AlertTriangle, Info } from "@/components/ui/icons";
import { Section, Container, SectionHeading } from "@/components/layout/layout-primitives";

const COPY = {
    error: "Diese Daten sind derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.",
    empty: "Für diese Auswahl liegen keine Daten vor.",
} as const;

/**
 * What a data widget shows instead of vanishing when its data is missing.
 *
 * A widget that silently renders nothing leaves an unexplained hole on a
 * public page and gives an editor in the builder no clue why their
 * component is invisible. This keeps the section's place and heading and
 * says, in plain words, what happened. Deliberately no technical detail
 * (the cause is logged server-side by the caller), no retry button (the
 * page is server-rendered; a reload is the retry), and the meaning is in
 * the words and icon, not the color alone.
 */
export function WidgetState({ kind, heading, tone }: { kind: keyof typeof COPY; heading?: string; tone?: "default" | "muted" }) {
    const isError = kind === "error";
    const Icon = isError ? AlertTriangle : Info;

    return (
        <Section tone={tone}>
            <Container>
                {heading && <SectionHeading>{heading}</SectionHeading>}
                <div
                    data-widget-state={kind}
                    className={
                        isError
                            ? "flex items-start gap-3 rounded-token border border-warning-border bg-warning-subtle p-4 text-sm text-warning"
                            : "flex items-start gap-3 rounded-token border border-border bg-surface p-4 text-sm text-copy-muted"
                    }
                >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <p>{COPY[kind]}</p>
                </div>
            </Container>
        </Section>
    );
}
