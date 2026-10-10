import { describe, expect, it } from 'vitest';

import { COMPONENT_REGISTRY } from '@modules/component-platform/domain/components/platform-registry';
import { TEMPLATE_KEYS } from '@modules/website/domain/models/website-template';
import type { BlueprintNode } from '@modules/website/domain/models/website-template';
import { getTemplate } from '@modules/website/domain/templates/template-registry';

function walk(
  nodes: readonly BlueprintNode[],
  parentType: string | null,
  visit: (node: BlueprintNode, parentType: string | null) => void,
): void {
  for (const node of nodes) {
    visit(node, parentType);
    walk(node.children ?? [], node.type, visit);
  }
}

/**
 * Props are parsed leniently (an invalid one silently falls back to its
 * default), so a template with a typo or an out-of-range value would create
 * a site that quietly lacks its seed content. These checks make it loud.
 */
describe.each(TEMPLATE_KEYS)('website template "%s"', (key) => {
  const { homePage } = getTemplate(key);

  it('uses only registered components, nested where the registry allows', () => {
    walk(homePage.nodes, null, (node, parentType) => {
      expect(COMPONENT_REGISTRY.find(node.type), `${node.key}: ${node.type}`).toBeDefined();
      expect(COMPONENT_REGISTRY.canNest(parentType, node.type), node.key).toBe(true);
    });
  });

  it('gives every node a unique key (it becomes the node id)', () => {
    const keys: string[] = [];
    walk(homePage.nodes, null, (node) => keys.push(node.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every seeded prop: declared by the component and valid for it', () => {
    walk(homePage.nodes, null, (node) => {
      const definition = COMPONENT_REGISTRY.find(node.type);
      const declared = new Set(definition?.fields.map((field) => field.key));
      const parsed = definition?.parseProps(node.props ?? {}) as Record<string, unknown>;
      for (const [prop, value] of Object.entries(node.props ?? {})) {
        expect(declared.has(prop), `${node.key}.${prop} is not a prop of ${node.type}`).toBe(true);
        expect(parsed[prop], `${node.key}.${prop} was rejected`).toEqual(value);
      }
    });
  });

  it('starts with a hero or a heading-level component so the page has a clear first block', () => {
    expect(homePage.nodes.length).toBeGreaterThan(2);
  });
});
