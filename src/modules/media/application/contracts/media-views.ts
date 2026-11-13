import type { Page, SortSpec } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { MediaVisibility } from '../../domain/models/media-asset';
import type { MediaFormat } from '../../domain/models/media-format';
import type { MediaSortField } from '../../domain/ports/media-asset.repository';

export interface MediaAssetView {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: MediaFormat;
  readonly byteSize: number;
  readonly visibility: MediaVisibility;
  readonly status: 'pending' | 'ready' | 'deleting';
  readonly createdAt: Date;
  /** Where anyone can load a public file from. `null` for a private one, or while no public origin is set. */
  readonly publicUrl: string | null;
}

/**
 * The one permission to write one file. It is a bearer capability until `expiresAt`: it goes to
 * the browser that asked and nowhere else, and is never logged or stored.
 */
interface UploadTargetView {
  readonly method: 'PUT';
  readonly url: string;
  /** Exactly the headers the browser must set. The body must be exactly `byteSize` bytes. */
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface RequestMediaUploadInput {
  readonly websiteId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly visibility: string;
}

export interface RequestedUpload {
  readonly asset: MediaAssetView;
  readonly upload: UploadTargetView;
}

export interface CompleteMediaUploadInput {
  readonly websiteId: string;
  readonly id: string;
}

export interface DeleteMediaAssetInput {
  readonly websiteId: string;
  readonly id: string;
}

export interface GetMediaReadUrlInput {
  readonly websiteId: string;
  readonly id: string;
}

/** A short-lived link to one private file. Same handling as an upload target. */
export interface MediaReadLinkView {
  readonly url: string;
  readonly expiresAt: Date;
}

/** The page asked for, as the address carries it: untrusted text, resolved by the use case. */
export interface ListMediaAssetsOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
  /** Only files of this kind; absent lists both. */
  readonly visibility?: MediaVisibility | undefined;
  /** Part of the file name; absent or empty lists every file. */
  readonly search?: string | undefined;
  /** Absent: newest first. */
  readonly sort?: SortSpec<MediaSortField> | undefined;
}

/** Presentation depends on query capabilities, never composition or persistence implementations. */
export interface MediaReaders {
  readonly listAssets: {
    execute(
      websiteId: string,
      options?: ListMediaAssetsOptions,
    ): AppResultAsync<Page<MediaAssetView>>;
  };
}
