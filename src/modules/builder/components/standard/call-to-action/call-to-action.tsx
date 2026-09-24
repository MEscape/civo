import { callToActionPropsSchema } from "./call-to-action.definition";
import { Section, Container } from "@/components/layout/layout-primitives";
import { Button } from "@/components/ui/button";

export function CallToAction({ props }: { props: Record<string, unknown> }) {
    const parsed = callToActionPropsSchema.safeParse(props);
    const { heading, body, buttonLabel, href } = parsed.success
        ? parsed.data
        : { heading: "Jetzt aktiv werden", body: undefined, buttonLabel: "Mehr erfahren", href: "#" };

    return (
        <Section>
            <Container>
                <div className="rounded-token bg-primary px-8 py-12 text-primary-foreground @2xl:px-12">
                    <div className="flex flex-col items-start gap-6 @2xl:flex-row @2xl:items-center @2xl:justify-between">
                        <div>
                            <h2 className="font-heading text-2xl">{heading}</h2>
                            {body && <p className="mt-2 max-w-lg text-primary-foreground/80">{body}</p>}
                        </div>
                        {/* The label is author-typed text: let it wrap (and the button grow) instead of overflowing.
                            Only from @2xl, where the row layout has room, does it keep its natural width. */}
                        <Button asChild variant="accent" size="lg" className="h-auto min-h-12 max-w-full whitespace-normal wrap-anywhere py-2 text-center @2xl:shrink-0">
                            <a href={href}>{buttonLabel}</a>
                        </Button>
                    </div>
                </div>
            </Container>
        </Section>
    );
}
