import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderPageNodes, PageNodeRenderer } from "./render-nodes";
import type { PageNode } from "@/modules/builder/domain/page-node";

describe("PageNodeRenderer: unknown component fallback", () => {
    it("renders the unknown-component placeholder for an unregistered type", () => {
        const node: PageNode = { id: "n1", type: "totally-made-up-type", props: {} };
        const { container } = render(<PageNodeRenderer node={node} />);
        expect(container.textContent).toContain("Unbekannte Komponente");
        expect(container.textContent).toContain("totally-made-up-type");
    });

    it("never throws for an unregistered type, even in editMode", () => {
        const node: PageNode = { id: "n1", type: "totally-made-up-type", props: {} };
        expect(() => render(<PageNodeRenderer node={node} editMode />)).not.toThrow();
    });
});

describe("PageNodeRenderer: editMode marker", () => {
    it("does NOT add the data-civo-node-id wrapper when editMode is false/omitted", () => {
        const node: PageNode = { id: "n1", type: "totally-made-up-type", props: {} };
        const { container } = render(<PageNodeRenderer node={node} />);
        expect(container.querySelector("[data-civo-node-id]")).toBeNull();
    });

    it("adds the data-civo-node-id wrapper only when editMode is true", () => {
        const node: PageNode = { id: "n1", type: "totally-made-up-type", props: {} };
        const { container } = render(<PageNodeRenderer node={node} editMode />);
        const marker = container.querySelector('[data-civo-node-id="n1"]');
        expect(marker).not.toBeNull();
        expect(marker?.getAttribute("data-civo-node-type")).toBe("totally-made-up-type");
    });
});

describe("renderPageNodes", () => {
    it("renders one entry per node, preserving order", () => {
        const nodes: PageNode[] = [
            { id: "a", type: "unknown-a", props: {} },
            { id: "b", type: "unknown-b", props: {} },
        ];
        const { container } = render(<>{renderPageNodes(nodes)}</>);
        const text = container.textContent ?? "";
        expect(text.indexOf("unknown-a")).toBeLessThan(text.indexOf("unknown-b"));
    });

    it("propagates editMode to every rendered node", () => {
        const nodes: PageNode[] = [
            { id: "a", type: "unknown-a", props: {} },
            { id: "b", type: "unknown-b", props: {} },
        ];
        const { container } = render(<>{renderPageNodes(nodes, true)}</>);
        expect(container.querySelectorAll("[data-civo-node-id]").length).toBe(2);
    });
});
