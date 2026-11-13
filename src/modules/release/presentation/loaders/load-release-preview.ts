import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';
import type { PageRequest } from '@lib/pagination';

import { parsePreviewParams } from '../schemas/parse-preview-position-input';

import type { ReleasePreviewView } from '../../application/contracts/preview-views';
import type { ReleaseReaders } from '../../application/contracts/screen-views';
import type { PublishedPageView } from '../../application/contracts/snapshot-views';

export interface LoadReleasePreviewInput {
  readonly websiteId: string;
  readonly releaseId: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: ReleaseReaders;
}

export interface ReleasePreviewScreen extends ReleasePreviewView {
  /** The page of the release being looked at. */
  readonly page: PublishedPageView;
  /** Where in the release list the person came from, so the way back lands there. */
  readonly from: PageRequest;
  /** The names of who published, by actor id; `null` when they could not be named. */
  readonly authors: Readonly<Record<string, string>> | null;
}

/** The page asked for by path; with no path asked, the home page, or the first one when there is none. */
function pickPage(
  pages: readonly PublishedPageView[],
  requested: string | undefined,
): PublishedPageView | undefined {
  return (
    pages.find((candidate) => candidate.path === (requested ?? '')) ??
    (requested === undefined ? pages[0] : undefined)
  );
}

/**
 * Reads one release as it can be looked at: the release found through the authorized website, the
 * page asked for and the name of who published it. A release or page that is not there, or not
 * this website's, gets "not found".
 */
export async function loadReleasePreview({
  websiteId,
  releaseId,
  searchParams,
  queries,
}: LoadReleasePreviewInput): Promise<ReleasePreviewScreen> {
  const { path, from } = parsePreviewParams(searchParams);
  const view = await orNotFound(queries.getReleasePreview.execute(websiteId, releaseId));
  const page = pickPage(view.snapshot.pages, path);
  if (page === undefined) {
    notFound();
  }
  const { publishedBy } = view.release;
  const names = publishedBy === null ? null : await queries.resolveMemberNames([publishedBy]);
  const authors = names?.isOk()
    ? Object.fromEntries(names.value.names.map(({ id, name }) => [id, name]))
    : null;

  return { ...view, page, from, authors };
}
