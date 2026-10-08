import type { ValidationAppError } from '@lib/errors';

import type {
  ContentKind,
  ContentOf,
  ContentSourceError,
  RenderMode,
} from './component-platform-constraints';

/**
 * Where the records came from, so the UI can be honest about it.
 * `sample` carries the error code that made the editor fall back, or `null`
 * when nothing is bound yet.
 */
export type ContentOrigin =
  | { readonly kind: 'live' }
  | { readonly kind: 'unbound' }
  | { readonly kind: 'sample'; readonly cause: string | null };

export interface ContentListView<K extends ContentKind> {
  readonly items: ReadonlyArray<ContentOf<K>>;
  readonly origin: ContentOrigin;
  /** More relevant records existed than the limit allowed. */
  readonly truncated: boolean;
}

/** What a data component asks for. Plain strings: props are untrusted until the use case parses them. */
export interface ContentListRequest<K extends ContentKind> {
  readonly kind: K;
  readonly mode: RenderMode;
  /** From the render context, never from component props. */
  readonly websiteId: string;
  readonly datasetId?: string | undefined;
  readonly category?: string | undefined;
  readonly limit?: number | undefined;
}

/**
 * Why a list could not be produced. A malformed website id is a bug
 * upstream, so it is reported as validation, not as "not found".
 */
export type ContentLoadError = ContentSourceError | ValidationAppError;
