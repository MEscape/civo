import type { TenantId } from '@modules/auth';

import type { ValidationAppError, FieldErrorBag } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isDefined, trimToNull } from '@lib/utils';

import { WEBSITE_VALIDATION_CODES, createWebsiteErrorBag } from '../errors/website-errors';

import { isTemplateKey } from './website-template';

import type { WebsiteId } from './ids';
import type { TemplateKey } from './website-template';
import type { WebsiteTheme } from './website-theme';

const CODES = WEBSITE_VALIDATION_CODES;

export const WEBSITE_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  descriptionMax: 500,
  slugMax: 80,
} as const;

/** Slugs become URL segments, so the rule is strict: lowercase, digits, single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface Website {
  readonly id: WebsiteId;
  /**
   * Owning tenant. Authorization compares it with the actor's tenant; it
   * must always come from the stored record, never from a request.
   */
  readonly tenantId: TenantId;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** Null only for rows created before templates existed. */
  readonly templateKey: TemplateKey | null;
  readonly theme: WebsiteTheme;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Everything but the theme: what a list needs, so lists never load theme rows. */
export type WebsiteSummary = Omit<Website, 'theme'>;

/** A validated website that has not been stored yet. */
export interface WebsiteDraft {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly templateKey: TemplateKey;
}

export interface WebsiteDraftInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null | undefined;
  readonly templateKey: string;
}

/** `undefined` leaves a field alone; `description: null` clears it. */
export interface WebsiteChangesInput {
  readonly name?: string | undefined;
  readonly description?: string | null | undefined;
}

export interface WebsiteChanges {
  readonly name?: string;
  readonly description?: string | null;
}

function slugViolation(slug: string): string | null {
  if (slug.length === 0) {
    return CODES.slugRequired;
  }
  if (slug.length > WEBSITE_LIMITS.slugMax) {
    return CODES.slugTooLong;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return CODES.slugInvalid;
  }
  return null;
}

export function isValidSlug(slug: string): boolean {
  return slugViolation(slug) === null;
}

function checkName(name: string, bag: FieldErrorBag): void {
  if (name.length < WEBSITE_LIMITS.nameMin) {
    bag.add('name', CODES.nameTooShort);
  } else if (name.length > WEBSITE_LIMITS.nameMax) {
    bag.add('name', CODES.nameTooLong);
  }
}

function checkSlug(slug: string, bag: FieldErrorBag): void {
  const violation = slugViolation(slug);
  if (violation !== null) {
    bag.add('slug', violation);
  }
}

function checkDescription(description: string | null, bag: FieldErrorBag): void {
  if (description !== null && description.length > WEBSITE_LIMITS.descriptionMax) {
    bag.add('description', CODES.descriptionTooLong);
  }
}

/** The only way a new website enters the system. Reports every invalid field. */
export function createWebsiteDraft(
  input: WebsiteDraftInput,
): AppResult<WebsiteDraft, ValidationAppError> {
  const bag = createWebsiteErrorBag();
  const name = input.name.trim();
  const slug = input.slug.trim();
  const description = trimToNull(input.description);
  const templateKey = isTemplateKey(input.templateKey) ? input.templateKey : null;

  checkName(name, bag);
  checkSlug(slug, bag);
  checkDescription(description, bag);
  if (templateKey === null) {
    bag.add('templateKey', CODES.templateUnknown);
  }

  if (bag.hasErrors || templateKey === null) {
    return err(bag.toError());
  }
  return ok({ name, slug, description, templateKey });
}

/** Validates a partial update; only the fields that were provided are checked. */
export function parseWebsiteChanges(
  input: WebsiteChangesInput,
): AppResult<WebsiteChanges, ValidationAppError> {
  const bag = createWebsiteErrorBag();
  const changes: { name?: string; description?: string | null } = {};

  if (isDefined(input.name)) {
    changes.name = input.name.trim();
    checkName(changes.name, bag);
  }
  if (isDefined(input.description)) {
    changes.description = trimToNull(input.description);
    checkDescription(changes.description, bag);
  }

  return bag.hasErrors ? err(bag.toError()) : ok(changes);
}

export function isEmptyChanges(changes: WebsiteChanges): boolean {
  return Object.keys(changes).length === 0;
}
