import { callToActionPropsSchema } from "./call-to-action.definition";
import { Section, Container } from "@/modules/builder/components/layout/layout-primitives";
import { Button } from "@/components/ui/button";

export function CallToAction({ props }: { props: Record<string, unknown> }) {
    const parsed = callToActionPropsSchema.safeParse(props);
    const { heading, body, buttonLabel, href } = parsed.success
        ? parsed.data
        : { heading: "Jetzt aktiv werden", body: undefined, buttonLabel: "Mehr erfahren", href: "#" };

    return (
        <Section>
            <Container>
                <div className="rounded-[var(--civo-radius)] bg-[var(--civo-color-primary)] px-8 py-12 text-white sm:px-12">
                    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-[family-name:var(--civo-font-heading)] text-2xl">{heading}</h2>
                            {body && <p className="mt-2 max-w-lg text-white/80">{body}</p>}
                        </div>
                        <Button asChild variant="accent" size="lg" className="shrink-0">
                            <a href={href}>{buttonLabel}</a>
                        </Button>
                    </div>
                </div>
            </Container>
        </Section>
    );
}
