export const BUILDER_MODES = ['select', 'preview'] as const;
export type BuilderMode = (typeof BUILDER_MODES)[number];

export const VIEWPORTS = ['desktop', 'tablet', 'mobile'] as const;
export type Viewport = (typeof VIEWPORTS)[number];

export interface UiState {
  readonly mode: BuilderMode;
  readonly viewport: Viewport;
  /** Derived on the server from the actor's permissions; never changes in a session. */
  readonly canRestructure: boolean;
  /** A stable code for the notice region; `null` when nothing needs attention. */
  readonly noticeCode: string | null;
}

export function createUiState(canRestructure: boolean): UiState {
  return { mode: 'select', viewport: 'desktop', canRestructure, noticeCode: null };
}
