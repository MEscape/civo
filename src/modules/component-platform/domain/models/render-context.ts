export const RENDER_MODES = ['published', 'draft'] as const;
export type RenderMode = (typeof RENDER_MODES)[number];

/**
 * What the server knows about the page being rendered. Components read the
 * website from here and never from their own props: props are authored by an
 * editor, the context is derived by the server.
 *
 * `websiteId` stays a plain string until a use case parses it, so no other
 * module's id type is needed to build a context.
 *
 * `draft` renders the editable canvas (markers for hit testing, sample data
 * allowed); `published` renders what visitors see.
 */
export interface RenderContext {
  readonly mode: RenderMode;
  readonly websiteId: string;
}
