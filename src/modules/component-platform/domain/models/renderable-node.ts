/**
 * The part of a page node the renderer needs. Declared here, not imported
 * from the builder, so the dependency runs builder -> component-platform:
 * the builder's own node type satisfies this structurally.
 */
export interface RenderableNode {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children?: readonly RenderableNode[] | undefined;
}
