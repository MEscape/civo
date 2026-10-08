import type { NodeProps } from '../models/page-tree';
import type { ResolvedComponent } from '../models/publishable';

/**
 * The release module's only view of the component registry. In memory and
 * synchronous: the registry ships with the running application, so asking
 * cannot fail, it can only be unknown.
 */
export interface ComponentCatalog {
  /** The component as registered right now; `null` if the type is unknown. */
  resolve(type: string): ResolvedComponent | null;

  /**
   * The props a freshly created node of `type` starts with at `version`;
   * `null` if that exact version is not retained, or its defaults are not
   * plain JSON. Registered versions are immutable, which is what makes this
   * a sound BASE for a migration's three-way merge.
   */
  defaultProps(type: string, version: number): NodeProps | null;
}
