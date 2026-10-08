import type { WebsiteId } from '../models/ids';
import type { PageNode } from '../models/page-node';

/**
 * Renders a draft tree for the editor canvas. Generic in its output so the
 * domain and application stay free of React: the composition root binds
 * `TOutput` to `ReactNode`.
 *
 * Contract: `websiteId` always comes from the stored page, never from a
 * request. Unregistered component types render a placeholder instead of
 * throwing, because stored pages may outlive a removed component.
 */
export interface DraftPageRenderer<TOutput> {
  render(input: { readonly websiteId: WebsiteId; readonly children: readonly PageNode[] }): TOutput;
}
