import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import { getComponentDefinition } from "@/modules/component-platform/domain";

export type TemplateKey = "municipal" | "smart-city" | "association";

export type WebsiteTemplate = {
    key: TemplateKey;
    label: string;
    description: string;
    generateHomePageConfig: () => PageConfig;
};

export function makeId(prefix: string, index: number): string {
    return `${prefix}-${index}`;
}

export function createNodeFromDefault(type: string, id: string, propsOverride?: Record<string, unknown>): PageNode {
    const defaultNode = getComponentDefinition(type).createDefaultNode();
    return {
        ...defaultNode,
        id,
        props: {
            ...defaultNode.props,
            ...propsOverride,
        },
    };
}
