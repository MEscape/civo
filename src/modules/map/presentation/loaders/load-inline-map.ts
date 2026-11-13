import type { InlineMapReaders } from '../../application/contracts/map-reader-views';
import type { SavedMapDraft } from '../../application/contracts/saved-map-views';

/** The signed token and the first window of an inline map; `null` when either cannot be produced. */
export async function loadInlineMap(
  queries: InlineMapReaders,
  target: {
    readonly websiteId: string;
    readonly mode: 'draft' | 'published';
    readonly draft: SavedMapDraft;
  },
) {
  const token = await queries.issueInlineMapToken.execute(target);
  if (token.isErr()) {
    return null;
  }
  const window = await queries.readInlineMapWindow.execute({
    token: token.value,
    bounds: target.draft.settings.initialBounds,
  });
  return window.isErr() ? null : { token: token.value, model: window.value };
}
