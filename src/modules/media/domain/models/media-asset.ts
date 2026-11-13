import type { TenantId } from '@modules/auth';

import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { MEDIA_VALIDATION_CODES, createMediaErrorBag } from '../errors/media-errors';

import { isMediaFormat } from './media-format';

import type { MediaAssetId } from './ids';
import type { MediaFormat } from './media-format';

export const MEDIA_VISIBILITIES = ['public', 'private'] as const;
export type MediaVisibility = (typeof MEDIA_VISIBILITIES)[number];

/**
 * `pending`: authorised, not verified. `ready`: verified, usable. `deleting`: hidden while its
 * object is removed; deleting again finishes the job.
 */
export type MediaStatus = 'pending' | 'ready' | 'deleting';

const MIB = 1_048_576;
const MAX_UPLOAD_MIB = 10;

export const MEDIA_LIMITS = {
  maxBytes: MAX_UPLOAD_MIB * MIB,
  fileNameMax: 120,
  /** How long the signed upload URL works. */
  uploadUrlSeconds: 300,
  /** How long an unfinished upload may wait before it counts as abandoned. */
  pendingLifetimeSeconds: 900,
  /** Unfinished uploads of one website at a time: the cheapest bound on what a client can queue. */
  maxPendingPerTenant: 20,
  /** How long a private file's signed read link works. */
  readUrlSeconds: 300,
  /** How many abandoned uploads one request clears: cleanup rides along with uploads and must stay cheap. */
  sweepBatch: 10,
} as const;

export interface MediaAsset {
  readonly id: MediaAssetId;
  readonly tenantId: TenantId;
  /** The canonical reference into the store. Derived, never user-supplied. */
  readonly objectKey: string;
  /** For display only. */
  readonly originalFilename: string;
  readonly contentType: MediaFormat;
  readonly byteSize: number;
  readonly visibility: MediaVisibility;
  readonly status: MediaStatus;
  /** The actor id of whoever authorised the upload. Plain text: the name is looked up where it is shown. */
  readonly createdBy: string;
  readonly uploadExpiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What a client announces before uploading. Untrusted until `parseUploadRequest`. */
interface UploadAnnouncement {
  readonly fileName: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly visibility: string;
}

export interface ValidUpload {
  readonly originalFilename: string;
  readonly contentType: MediaFormat;
  readonly byteSize: number;
  readonly visibility: MediaVisibility;
}

/** Where objects live: `sites/<tenant>/media/<asset>`. Only trusted ids go in, never a file name. */
export function mediaObjectKey(tenantId: string, assetId: MediaAssetId): string {
  return `sites/${tenantId}/media/${assetId}`;
}

// Control characters and the bidirectional overrides that make a name read backwards.
// eslint-disable-next-line no-control-regex -- the point of this pattern is to match control characters
const UNSAFE_NAME_CHARACTERS = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * A name fit to show: the last path segment, Unicode-normalised, without control or
 * direction-flipping characters, shortened. It is display text only; nothing derives a key from it.
 */
export function sanitizeFileName(raw: string): string {
  const lastSegment = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = lastSegment
    .normalize('NFC')
    .replace(UNSAFE_NAME_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MEDIA_LIMITS.fileNameMax);
}

function isVisibility(value: string): value is MediaVisibility {
  return (MEDIA_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * Checks what a client announced against the platform's rules. The announcement is a claim:
 * the stored object is checked again when the upload is finalised.
 */
export function parseUploadRequest(
  input: UploadAnnouncement,
): AppResult<ValidUpload, ValidationAppError> {
  const bag = createMediaErrorBag();
  const originalFilename = sanitizeFileName(input.fileName);
  const contentType = input.contentType.trim().toLowerCase();

  bag.expect(originalFilename.length > 0, 'fileName', MEDIA_VALIDATION_CODES.fileNameInvalid);
  bag.expect(
    isMediaFormat(contentType),
    'contentType',
    MEDIA_VALIDATION_CODES.contentTypeUnsupported,
  );
  const sizeOk = bag.expect(
    Number.isInteger(input.byteSize) && input.byteSize > 0,
    'byteSize',
    MEDIA_VALIDATION_CODES.sizeInvalid,
  );
  if (sizeOk) {
    bag.expect(
      input.byteSize <= MEDIA_LIMITS.maxBytes,
      'byteSize',
      MEDIA_VALIDATION_CODES.sizeTooLarge,
    );
  }
  bag.expect(
    isVisibility(input.visibility),
    'visibility',
    MEDIA_VALIDATION_CODES.visibilityUnsupported,
  );

  if (bag.hasErrors || !isMediaFormat(contentType) || !isVisibility(input.visibility)) {
    return err(bag.toError());
  }
  return ok({
    originalFilename,
    contentType,
    byteSize: input.byteSize,
    visibility: input.visibility,
  });
}
