import { richTextPropsSchema } from "./rich-text.definition";
import { Section, Container } from "@/modules/builder/components/layout/layout-primitives";

export function RichText({ props }: { props: Record<string, unknown> }) {
    const parsed = richTextPropsSchema.safeParse(props);
    const { heading, body } = parsed.success ? parsed.data : { heading: undefined, body: "" };

    return (
        <Section>
            <Container className="max-w-3xl">
                {heading && (
                    <h2 className="mb-4 font-[family-name:var(--civo-font-heading)] text-2xl text-[var(--civo-color-text)]">
                        {heading}
                    </h2>
                )}
                <p className="text-base leading-relaxed text-[var(--civo-color-text)]">{body}</p>
            </Container>
        </Section>
    );
}
