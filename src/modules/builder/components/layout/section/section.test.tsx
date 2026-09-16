import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionNode } from "@/modules/builder/components/layout/section/section";

/**
 * Confirms the editor-only empty-container state (Phase 2 spec §35) is
 * strictly gated by `editMode`. This is a correctness property worth
 * locking in with a real render test — an empty Section leaking its
 * placeholder text into the public site would be a visible product bug,
 * not just an internal wiring detail.
 */
describe("SectionNode empty-container state", () => {
    it("shows the empty-state placeholder when editMode is true and there are no children", () => {
        render(<SectionNode props={{}} editMode={true} />);
        expect(screen.getByText(/leere section/i)).toBeInTheDocument();
    });

    it("renders nothing extra when editMode is false, even with no children (public site path)", () => {
        const { container } = render(<SectionNode props={{}} editMode={false} />);
        expect(screen.queryByText(/leere section/i)).not.toBeInTheDocument();
        expect(container.textContent).toBe("");
    });

    it("does not show the empty-state placeholder when children are present", () => {
        const childNodes = [{ id: "hero-1", type: "hero", props: { title: "Willkommen" } }];
        // `children` prop is PageNode[] data, not JSX composition; there is
        // no nesting syntax for passing a typed data array as this prop.
        // eslint-disable-next-line react/no-children-prop
        render(<SectionNode props={{}} editMode={true} children={childNodes} />);
        expect(screen.queryByText(/leere section/i)).not.toBeInTheDocument();
    });
});
