import type { TenantId } from '@modules/auth';

import type { ComponentDescriptor } from '../../domain/models/component-descriptor';
import type { EditorMode } from '../../domain/models/editor-capabilities';
import type { PageDraftInput } from '../../domain/models/page';
import type { PageConfig, PageConfigJson } from '../../domain/models/page-config';

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
 * Everything the editor needs to start: the page, the mode this actor is
 * allowed (derived on the server), and the component catalog as data.
 */
export interface EditorSessionView {
  readonly page: PageView;
  readonly editorMode: EditorMode;
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
  readonly limit?: number;
}
