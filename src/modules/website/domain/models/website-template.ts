import { literalGuard } from '@lib/utils';

export const TEMPLATE_KEYS = ['municipal', 'smart-city', 'association'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Narrows untrusted text (a stored row, a request value) to a known template. */
export const isTemplateKey = literalGuard(TEMPLATE_KEYS);

/**
 * One node of a home page, described without any builder or component
 * types. `type` names a component in the builder's registry; the builder
 * validates it when the page is provisioned, which keeps this module free
 * of the component platform.
 *
 * `key` is unique within one blueprint and becomes the node id, so
 * provisioning is deterministic (no randomness in the domain).
 */
export interface BlueprintNode {
  readonly key: string;
  readonly type: string;
  /** Overrides only; the builder fills every other prop from component defaults. */
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly BlueprintNode[];
}

export interface HomePageBlueprint {
  readonly title: string;
  readonly nodes: readonly BlueprintNode[];
}

/**
 * A template is used ONCE, when a website is created. Afterwards the
 * website owns its pages; later edits to a template never reach existing
 * websites. Labels and descriptions shown in the UI are translations
 * (presentation), not domain data.
 */
export interface WebsiteTemplate {
  readonly key: TemplateKey;
  readonly homePage: HomePageBlueprint;
}
