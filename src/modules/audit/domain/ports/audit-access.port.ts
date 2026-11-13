import type {
  ForbiddenAppError,
  InfrastructureAppError,
  UnauthorizedAppError,
  ValidationAppError,
} from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

/** Everything the reader's authorization can refuse or fail with; nothing provider-specific. */
export type AuditAccessError =
  UnauthorizedAppError | ForbiddenAppError | ValidationAppError | InfrastructureAppError;

/**
 * The websites the reader may read the trail of. `isPlatform` is platform-wide authority, with no
 * allowlist: the reader may read the entries of every website. Otherwise `websites` is the
 * reader's own list, and `isTruncated` says the reader may read more websites than it names.
 * `id`s are those of websites the authorizing module already checked.
 */
export interface ReadableWebsites {
  readonly isPlatform: boolean;
  readonly websites: ReadonlyArray<{ readonly id: WebsiteId; readonly name: string }>;
  readonly isTruncated: boolean;
}

/**
 * Who may read which part of the trail, decided from the signed-in reader's own memberships.
 * Every read use case asks it before it reads anything. The audit module depends on no other
 * module (every module feeds its trail), so the application's composition root supplies the
 * adapter that answers from the authorization of the auth module.
 */
export interface AuditAccess {
  /** Whether the reader may read this website's trail (`audit.read` there). */
  authorizeWebsite(websiteId: WebsiteId): AppResultAsync<void, AuditAccessError>;

  /** Every website the reader may read the trail of; refused when there is none. */
  listReadableWebsites(): AppResultAsync<ReadableWebsites, AuditAccessError>;
}
