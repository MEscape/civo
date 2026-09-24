import { sectionPropsSchema } from "./section.definition";
import { Section as SectionPrimitive, Container } from "@/components/layout/layout-primitives";
import { renderPageNodes } from "@/modules/component-platform/infrastructure/render-nodes";
import type { PageNode } from "@/modules/builder/domain/page-node";

const spacingScale: Record<"compact" | "comfortable" | "spacious", string> = {
    compact: "2.5rem",
    comfortable: "4rem",
    spacious: "6rem",
};

/**
 * SectionNode — the one container type in the registry that can hold
 * other PageNodes as children (Phase 2 spec §6, §13: "Page > Section >
 * Hero" nesting). This is distinct from the `Section` layout primitive
 * (components/website/layout/layout-primitives.tsx), which every other
 * component already uses internally for its own vertical rhythm and
 * takes plain React children — not PageNode[]. Renaming that primitive
 * was avoided (Phase 2 spec §50: don't rename working code without
 * reason); this component composes it instead.
 *
 * Registered in the component registry as `type: "section"`. Renders its
 * `children: PageNode[]` through the shared `renderPageNodes` helper, so
 * both the public PageRenderer and the builder canvas render this
 * exactly the same way (spec §6 — "both should remain representations
 * of the same page configuration").
 */
export function SectionNode({
                                props,
                                children,
                                editMode = false,
                            }: {
    props: Record<string, unknown>;
    children?: PageNode[];
    editMode?: boolean;
}) {
    const parsed = sectionPropsSchema.safeParse(props);
    const { spacing, tone } = parsed.success
        ? parsed.data
        : { spacing: "comfortable" as const, tone: "default" as const };

    const isEmpty = !children || children.length === 0;

    return (
        <SectionPrimitive tone={tone} style={{ paddingBlock: spacingScale[spacing] }}>
            <Container className="flex flex-col gap-8">
                {isEmpty ? (
                    // Editor-only empty-container state (Phase 2 spec §35). Rendered
                    // ONLY when editMode is true — i.e. only inside the builder
                    // canvas/preview, via renderCanvasAction. The public PageRenderer
                    // never passes editMode, so an empty Section on a live site
                    // simply renders nothing, and this placeholder markup never
                    // reaches persisted PageConfig or public HTML.
                    editMode && (
                        <div className="rounded-token border border-dashed border-border px-4 py-6 text-center text-sm text-copy-muted">
                            Leere Section — Komponente aus der linken Liste hierher ziehen.
                        </div>
                    )
                ) : (
                    renderPageNodes(children, editMode)
                )}
            </Container>
        </SectionPrimitive>
    );
}
