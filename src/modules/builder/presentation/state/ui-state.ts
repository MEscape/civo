import type { EditorMode } from '../../application/contracts/builder-constraints';

export const BUILDER_MODES = ['select', 'preview'] as const;
export type BuilderMode = (typeof BUILDER_MODES)[number];

export const VIEWPORTS = ['desktop', 'tablet', 'mobile'] as const;
export type Viewport = (typeof VIEWPORTS)[number];

export interface UiState {
  readonly mode: BuilderMode;
  readonly viewport: Viewport;
  /** Derived on the server from the actor's permissions; never changes in a session. */
  readonly editorMode: EditorMode;
  /** A stable code for the notice region; `null` when nothing needs attention. */
  readonly noticeCode: string | null;
}

export function createUiState(editorMode: EditorMode): UiState {
  return { mode: 'select', viewport: 'desktop', editorMode, noticeCode: null };
}
