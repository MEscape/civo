import type { ComponentDescriptor } from '../../domain/models/component-descriptor';
import type { PageConfig } from '../../domain/models/page-config';
import type { OutlineBlock } from '../../domain/models/page-outline';

/** The page content as consumers see it. Plain, serializable, fully validated. */
export type PageConfigView = PageConfig;

/** A page row for its owner. The tenant is an internal detail and is not exposed. */
export interface PageSummaryView {
  readonly id: string;
  readonly websiteId: string;
  readonly path: string;
  readonly title: string;
  /** The latest saved revision; send it back as `expectedVersion` when saving. */
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A page's title by id, for a screen that keeps only the id (the audit log). */
export interface PageTitleView {
  readonly id: string;
  readonly title: string;
}

/** A page in the page list: a sketch of its top-level blocks, `null` when its config cannot be read. */
export interface PageListItemView extends PageSummaryView {
  readonly outline: readonly OutlineBlock[] | null;
}

export interface PageView extends PageSummaryView {
  readonly config: PageConfigView;
}

export interface SavedRevisionView {
  readonly pageId: string;
  readonly websiteId: string;
  readonly path: string;
  readonly version: number;
  readonly savedAt: Date;
}

/**
 * Everything the editor needs to start: the page, whether this actor may
 * restructure pages (derived on the server), and the component catalog as data.
 */
export interface EditorSessionView {
  readonly page: PageView;
  readonly canRestructure: boolean;
  readonly components: readonly ComponentDescriptor[];
}
