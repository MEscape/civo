import type { TenantId } from '@modules/auth';

import type { ComponentDescriptor } from '../../domain/models/component-descriptor';
import type { PageDraftInput } from '../../domain/models/page';
import type { PageConfig, PageConfigJson } from '../../domain/models/page-config';
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

/** One page that reads a dataset, with the components on it that do. */
export interface DatasetPageUseView {
  readonly pageId: string;
  readonly title: string;
  readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
}

/** A component still showing sample data: its dataset field has nothing chosen. */
export interface ComponentAwaitingDataView {
  readonly pageId: string;
  readonly title: string;
  readonly nodeId: string;
  readonly type: string;
  /** The content kind its dataset field asks for. */
  readonly kind: string;
}

export interface DatasetUsageView {
  /** The pages that read each dataset, by dataset id; a dataset no page reads is absent. */
  readonly byDataset: Readonly<Record<string, readonly DatasetPageUseView[]>>;
  /** Where data could go next, in page order. */
  readonly awaiting: readonly ComponentAwaitingDataView[];
}

/** A page in the page list: a sketch of its top-level blocks, `null` when its config cannot be read. */
export interface PageListItemView extends PageSummaryView {
  readonly outline: readonly OutlineBlock[] | null;
}

export interface PageView extends PageSummaryView {
  readonly config: PageConfigView;
}

/**
 * A page as a publisher sees it: either usable, with its config as plain
 * JSON plus the component types it uses, or the reason it is not.
 */
export type ReleasePageView =
  | {
      readonly status: 'ready';
      readonly pageId: string;
      readonly version: number;
      readonly path: string;
      readonly title: string;
      readonly config: PageConfigJson;
      readonly componentTypes: readonly string[];
    }
  | {
      readonly status: 'config_missing' | 'config_invalid';
      readonly pageId: string;
      readonly version: number;
      readonly path: string;
      readonly title: string;
    };

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

/** Untrusted node shape, as it arrives from a request or another module. */
export interface PageNodeInput {
  readonly id: string;
  readonly type: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children?: readonly PageNodeInput[] | undefined;
}

export interface PageConfigInput {
  readonly type: 'page';
  readonly children: readonly PageNodeInput[];
}

export type CreatePageInput = PageDraftInput;

/**
 * The tenant is passed by a trusted module from the STORED website record
 * (`website.tenantId`); a request value must never reach this field.
 */
export interface CreateSystemPageInput {
  readonly tenantId: TenantId;
  readonly websiteId: string;
  readonly path: string;
  readonly title: string;
  readonly nodes: readonly PageNodeInput[];
}

export interface SavePageConfigInput {
  readonly pageId: string;
  readonly expectedVersion: number;
  readonly config: PageConfigInput;
}

export interface RenderDraftPageInput {
  readonly pageId: string;
  readonly config: PageConfigInput;
}

export interface ListPagesInput {
  readonly websiteId: string;
  /** The page asked for, as the address carries it: untrusted text, resolved by the query. */
  readonly page?: unknown;
  readonly pageSize?: unknown;
}
