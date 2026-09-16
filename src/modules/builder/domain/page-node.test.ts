import { describe, expect, it } from "vitest";
import {
    collectNodeIds,
    findNodeById,
    type PageNode,
} from "./page-node";

describe("collectNodeIds", () => {
    it("collects the ids of root nodes", () => {
        const nodes: PageNode[] = [
            {
                id: "root-1",
                type: "container",
                props: {},
            },
            {
                id: "root-2",
                type: "text",
                props: {},
            },
        ];

        expect(collectNodeIds(nodes)).toEqual(["root-1", "root-2"]);
    });

    it("collects ids recursively from children", () => {
        const nodes: PageNode[] = [
            {
                id: "root",
                type: "container",
                props: {},
                children: [
                    {
                        id: "child-1",
                        type: "text",
                        props: {},
                    },
                    {
                        id: "child-2",
                        type: "container",
                        props: {},
                        children: [
                            {
                                id: "grandchild",
                                type: "button",
                                props: {},
                            },
                        ],
                    },
                ],
            },
        ];

        expect(collectNodeIds(nodes)).toEqual([
            "root",
            "child-1",
            "child-2",
            "grandchild",
        ]);
    });

    it("preserves depth-first traversal order", () => {
        const nodes: PageNode[] = [
            {
                id: "a",
                type: "container",
                props: {},
                children: [
                    {
                        id: "b",
                        type: "container",
                        props: {},
                        children: [
                            {
                                id: "c",
                                type: "text",
                                props: {},
                            },
                        ],
                    },
                    {
                        id: "d",
                        type: "text",
                        props: {},
                    },
                ],
            },
            {
                id: "e",
                type: "text",
                props: {},
            },
        ];

        expect(collectNodeIds(nodes)).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("returns an empty array for an empty node list", () => {
        expect(collectNodeIds([])).toEqual([]);
    });

    it("handles nodes without children", () => {
        const nodes: PageNode[] = [
            {
                id: "text-1",
                type: "text",
                props: { content: "Hello" },
            },
        ];

        expect(collectNodeIds(nodes)).toEqual(["text-1"]);
    });

    it("handles explicitly empty children arrays", () => {
        const nodes: PageNode[] = [
            {
                id: "container",
                type: "container",
                props: {},
                children: [],
            },
        ];

        expect(collectNodeIds(nodes)).toEqual(["container"]);
    });

    it("does not modify the input tree", () => {
        const nodes: PageNode[] = [
            {
                id: "root",
                type: "container",
                props: {},
                children: [
                    {
                        id: "child",
                        type: "text",
                        props: {},
                    },
                ],
            },
        ];

        const original = structuredClone(nodes);

        collectNodeIds(nodes);

        expect(nodes).toEqual(original);
    });
});

describe("findNodeById", () => {
    const nodes: PageNode[] = [
        {
            id: "root",
            type: "container",
            props: {},
            children: [
                {
                    id: "child-1",
                    type: "text",
                    props: {
                        content: "Hello",
                    },
                },
                {
                    id: "child-2",
                    type: "container",
                    props: {},
                    children: [
                        {
                            id: "grandchild",
                            type: "button",
                            props: {
                                label: "Click me",
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: "second-root",
            type: "image",
            props: {
                src: "/image.png",
            },
        },
    ];

    it("finds a root node", () => {
        const result = findNodeById(nodes, "root");

        expect(result).toBe(nodes[0]);
    });

    it("finds a direct child", () => {
        const result = findNodeById(nodes, "child-1");

        expect(result).toBe(nodes[0].children![0]);
    });

    it("finds a deeply nested node", () => {
        const result = findNodeById(nodes, "grandchild");

        expect(result).toBe(nodes[0].children![1].children![0]);
    });

    it("finds nodes in later root branches", () => {
        const result = findNodeById(nodes, "second-root");

        expect(result).toBe(nodes[1]);
    });

    it("returns undefined when the id does not exist", () => {
        expect(findNodeById(nodes, "does-not-exist")).toBeUndefined();
    });

    it("returns undefined for an empty node list", () => {
        expect(findNodeById([], "anything")).toBeUndefined();
    });

    it("handles nodes without children", () => {
        const nodesWithoutChildren: PageNode[] = [
            {
                id: "text",
                type: "text",
                props: {},
            },
        ];

        expect(findNodeById(nodesWithoutChildren, "text")).toBe(
            nodesWithoutChildren[0],
        );
    });

    it("does not mutate the tree", () => {
        const original = structuredClone(nodes);

        findNodeById(nodes, "grandchild");

        expect(nodes).toEqual(original);
    });
});
