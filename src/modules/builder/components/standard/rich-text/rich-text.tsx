import { richTextPropsSchema } from "./rich-text.definition";
import { Section, Container } from "@/components/layout/layout-primitives";

export function RichText({ props }: { props: Record<string, unknown> }) {
    const parsed = richTextPropsSchema.safeParse(props);
    const { heading, body } = parsed.success ? parsed.data : { heading: undefined, body: "" };

    return (
        <Section>
            <Container className="max-w-3xl">
                {heading && (
                    <h2 className="mb-4 font-heading text-2xl text-copy">
                        {heading}
                    </h2>
                )}
                <p className="text-base leading-relaxed text-copy">{body}</p>
            </Container>
        </Section>
    );
}
