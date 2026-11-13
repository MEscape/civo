import type { Page } from '@lib/pagination';

import type {
  MediaAssetView,
  MediaReadLinkView,
  RequestedUpload,
} from '../../application/contracts/media-views';

/** The JSON-safe shapes Server Actions return: dates as ISO-8601 strings. */
export interface MediaAssetDto {
  readonly id: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly visibility: 'public' | 'private';
  readonly status: 'pending' | 'ready' | 'deleting';
  readonly createdAt: string;
  readonly publicUrl: string | null;
}

/** A bearer capability until `expiresAt`: it belongs to the browser that asked and nowhere else. */
export interface RequestedUploadDto {
  readonly asset: MediaAssetDto;
  readonly upload: {
    readonly method: 'PUT';
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly expiresAt: string;
  };
}

export interface MediaReadLinkDto {
  readonly url: string;
  readonly expiresAt: string;
}

export function toMediaAssetDto(view: MediaAssetView): MediaAssetDto {
  return {
    id: view.id,
    originalFilename: view.originalFilename,
    contentType: view.contentType,
    byteSize: view.byteSize,
    visibility: view.visibility,
    status: view.status,
    createdAt: view.createdAt.toISOString(),
    publicUrl: view.publicUrl,
  };
}

export function toRequestedUploadDto(requested: RequestedUpload): RequestedUploadDto {
  const { upload } = requested;
  return {
    asset: toMediaAssetDto(requested.asset),
    upload: {
      method: upload.method,
      url: upload.url,
      headers: upload.headers,
      expiresAt: upload.expiresAt.toISOString(),
    },
  };
}

export function toMediaReadLinkDto(link: MediaReadLinkView): MediaReadLinkDto {
  return { url: link.url, expiresAt: link.expiresAt.toISOString() };
}

export interface MediaAssetPageDto {
  readonly items: readonly MediaAssetDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
}

export function toMediaAssetPageDto(found: Page<MediaAssetView>): MediaAssetPageDto {
  return {
    items: found.items.map(toMediaAssetDto),
    page: found.page,
    pageSize: found.pageSize,
    total: found.total,
    pageCount: found.pageCount,
  };
}
