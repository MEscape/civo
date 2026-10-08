import type { TenantId } from '@modules/auth';

import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BUILDER_VALIDATION_CODES as CODES,
  createBuilderErrorBag,
  fieldValidationFailed,
} from '../errors/builder-errors';

import { isValidEntityId, toWebsiteId } from './ids';
import { EMPTY_PAGE_CONFIG, readPageConfig } from './page-config';

import type { PageId, WebsiteId } from './ids';
import type { PageConfig } from './page-config';

export const PAGE_LIMITS = {
  titleMin: 2,
  titleMax: 120,
  pathMax: 200,
} as const;

/** The root page has an empty path. */
export const HOME_PAGE_PATH = '';

/** First revision of a new page. Saves increment it (optimistic concurrency). */
export const INITIAL_PAGE_VERSION = 1;

/** A page keeps its newest revisions; older ones are pruned by the save that supersedes them. */
export const PAGE_REVISION_LIMIT = 50;

/** Paths become URL segments: lowercase, digits, single hyphens, `/` between segments. */
export const PAGE_PATH_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;

/** What a list needs; carries no config, so lists never load page JSON. */
export interface PageSummary {
  readonly id: PageId;
  /**
   * Owning tenant, equal to the website's tenant (the database enforces
   * that). Authorization compares it with the actor's tenant; it must
   * always come from the stored record, never from a request.
   */
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
  readonly path: string;
  readonly title: string;
  /** The latest saved revision. */
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Page extends PageSummary {
  readonly config: PageConfig;
}

/** The validated, normalized fields every new page starts from. */
export interface PageFields {
  readonly websiteId: WebsiteId;
  readonly path: string;
  readonly title: string;
}

/** A validated page that has not been stored yet. The tenant travels beside it (`NewPage`). */
export interface PageDraft extends PageFields {
  readonly config: PageConfig;
}

export interface PageDraftInput {
  readonly websiteId: string;
  readonly path: string;
  readonly title: string;
}

/** A page seeded with a configuration, e.g. a template's home page. */
export interface SystemPageDraftInput extends PageDraftInput {
  /** Untrusted until parsed: it is shaped by another module's blueprint. */
  readonly nodes: unknown;
}

function pathViolation(path: string): string | null {
  if (path === HOME_PAGE_PATH) {
    return null;
  }
  if (path.length > PAGE_LIMITS.pathMax) {
    return CODES.pathTooLong;
  }
  return PAGE_PATH_PATTERN.test(path) ? null : CODES.pathInvalid;
}

function checkTitle(title: string, bag: FieldErrorBag): void {
  if (title.length < PAGE_LIMITS.titleMin) {
    bag.add('title', CODES.titleTooShort);
  } else if (title.length > PAGE_LIMITS.titleMax) {
    bag.add('title', CODES.titleTooLong);
  }
}

function checkPath(path: string, bag: FieldErrorBag): void {
  const violation = pathViolation(path);
  if (violation !== null) {
    bag.add('path', violation);
  }
}

function checkFields(input: PageDraftInput, bag: FieldErrorBag): PageFields | null {
  const title = input.title.trim();
  const path = input.path.trim();
  const isWebsiteIdValid = isValidEntityId(input.websiteId);

  if (!isWebsiteIdValid) {
    bag.add('websiteId', CODES.idInvalid);
  }
  checkTitle(title, bag);
  checkPath(path, bag);

  if (!isWebsiteIdValid || bag.hasErrors) {
    return null;
  }
  return { websiteId: toWebsiteId(input.websiteId), path, title };
}

/** A new, empty page. Reports every invalid field. */
export function createPageDraft(input: PageDraftInput): AppResult<PageDraft, ValidationAppError> {
  const bag = createBuilderErrorBag();
  const fields = checkFields(input, bag);
  if (fields === null) {
    return err(bag.toError());
  }
  return ok({ ...fields, config: EMPTY_PAGE_CONFIG });
}

/** A page seeded with a configuration. Page fields and the tree are reported in one pass. */
export function createSystemPageDraft(
  input: SystemPageDraftInput,
): AppResult<PageDraft, ValidationAppError> {
  const bag = createBuilderErrorBag();
  const fields = checkFields(input, bag);
  const config = readPageConfig(input.nodes, 'nodes', bag);
  if (fields === null || config === null) {
    return err(bag.toError());
  }
  return ok({ ...fields, config });
}

/** The revision an editor claims to have loaded; untrusted until checked. */
export function parsePageVersion(raw: number): AppResult<number, ValidationAppError> {
  return Number.isSafeInteger(raw) && raw >= INITIAL_PAGE_VERSION
    ? ok(raw)
    : err(fieldValidationFailed('expectedVersion', CODES.versionInvalid));
}
