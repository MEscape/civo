import { heroPropsSchema } from "./hero.definition";
import { Container } from "@/components/layout/layout-primitives";

export function Hero({ props }: { props: Record<string, unknown> }) {
    const parsed = heroPropsSchema.safeParse(props);
    const { title, subtitle, imageUrl } = parsed.success
        ? parsed.data
        : { title: "Titel", subtitle: undefined, imageUrl: undefined };

    return (
        <section
            className="relative overflow-hidden"
            style={{ paddingBlock: "calc(var(--civo-section-spacing) * 1.4)" }}
        >
            {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover opacity-10"
                />
            )}
            <Container className="relative">
                <h1 className="max-w-3xl font-[family-name:var(--civo-font-heading)] text-4xl leading-tight text-[var(--civo-color-primary)] sm:text-5xl">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-4 max-w-xl text-lg text-[var(--civo-color-text-muted)]">{subtitle}</p>
                )}
            </Container>
        </section>
    );
}
