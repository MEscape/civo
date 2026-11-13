import type { TenantId } from '@modules/auth';

import type { PageDraftInput } from '../../domain/models/page';

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
  readonly websiteId: string;
  readonly pageId: string;
  readonly expectedVersion: number;
  readonly config: PageConfigInput;
}

export interface RenderDraftPageInput {
  readonly websiteId: string;
  readonly pageId: string;
  readonly config: PageConfigInput;
  /** Draw the draft as visitors will see it (the editor's preview), not as the editing canvas. */
  readonly isPreview?: boolean | undefined;
}

export interface ListPagesInput {
  readonly websiteId: string;
  /** The page asked for, as the address carries it: untrusted text, resolved by the query. */
  readonly page?: unknown;
  readonly pageSize?: unknown;
}
