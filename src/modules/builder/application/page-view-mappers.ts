import { serializePageConfig } from '../domain/models/page-config';
import { collectNodeTypes } from '../domain/tree/tree-operations';

import type {
  EditorSessionView,
  PageSummaryView,
  PageView,
  ReleasePageView,
  SavedRevisionView,
} from './contracts/page-views';
import type { ComponentCatalog } from '../domain/models/component-catalog';
import type { EditorMode } from '../domain/models/editor-capabilities';
import type { Page, PageSummary } from '../domain/models/page';
import type { SavedRevision } from '../domain/models/page-revision';
import type { ReleasePage } from '../domain/models/release-page';

// Fields are copied one by one on purpose: spreading a stored page would leak `tenantId`.
export function toPageSummaryView(summary: PageSummary): PageSummaryView {
  return {
    id: summary.id,
    websiteId: summary.websiteId,
    path: summary.path,
    title: summary.title,
    version: summary.version,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

export function toPageView(page: Page): PageView {
  return { ...toPageSummaryView(page), config: page.config };
}

export function toSavedRevisionView(revision: SavedRevision, page: PageSummary): SavedRevisionView {
  return {
    pageId: page.id,
    websiteId: page.websiteId,
    path: page.path,
    version: revision.version,
    savedAt: revision.savedAt,
  };
}

export function toReleasePageView(page: ReleasePage): ReleasePageView {
  const { pageId, version, path, title, state } = page;
  if (state.status !== 'ready') {
    return { status: state.status, pageId, version, path, title };
  }
  return {
    status: 'ready',
    pageId,
    version,
    path,
    title,
    config: serializePageConfig(state.config),
    componentTypes: collectNodeTypes(state.config.children),
  };
}

export function toEditorSessionView(input: {
  readonly page: Page;
  readonly editorMode: EditorMode;
  readonly catalog: ComponentCatalog;
}): EditorSessionView {
  return {
    page: toPageView(input.page),
    editorMode: input.editorMode,
    components: input.catalog.descriptors,
  };
}
