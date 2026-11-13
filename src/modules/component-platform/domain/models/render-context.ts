import type { SavedMapDraft } from '@modules/map/client';

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
 * allowed); `published` renders what visitors see (also for an editor's preview, see `isPreview`).
 *
 * A published page draws its saved maps from `publishedMaps`, the copies a release froze, never
 * from the stored ones: editing a map must not change a live page before the next publish. A map
 * missing from it (private, damaged, or never published) is shown as empty.
 */
export interface RenderContext {
  readonly mode: RenderMode;
  readonly websiteId: string;
  /**
   * An editor's draft shown as visitors will see it (`published` rendering: no sample content, no
   * editing marks). Its saved maps come from their stored settings, as a release has not frozen
   * them yet.
   */
  readonly isPreview?: boolean | undefined;
  readonly publishedMaps?: Readonly<Record<string, SavedMapDraft>> | undefined;
}
