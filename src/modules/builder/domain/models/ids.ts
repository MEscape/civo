import { createIdParser } from '@lib/result';
import { identity } from '@lib/utils';
import type { Brand } from '@lib/utils';

import { BUILDER_VALIDATION_CODES as CODES, fieldValidationFailed } from '../errors/builder-errors';

export type PageId = Brand<string, 'PageId'>;
export type PageNodeId = Brand<string, 'PageNodeId'>;

/**
 * The builder's reference to the website that owns a page. Opaque: the
 * builder knows nothing else about websites, so it never imports the
 * website module. A page carries its website's tenant, so no ownership
 * lookup is needed.
 */
export type WebsiteId = Brand<string, 'WebsiteId'>;

export const ID_MAX_LENGTH = 128;

/**
 * Node ids end up in `data-civo-node-id` attributes and selectors, so the
 * alphabet excludes quotes, brackets and whitespace.
 */
export const NODE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

/**
 * Seeds come from the caller (a UUID); the domain itself never generates
 * randomness. Alphanumeric only, so a derived id stays inside
 * `NODE_ID_PATTERN` and under `ID_MAX_LENGTH` (type <= 64, seed <= 36).
 */
export const ID_SEED_PATTERN = /^[A-Za-z0-9]{1,36}$/;

export function isValidEntityId(raw: string): boolean {
  return raw.length > 0 && raw.length <= ID_MAX_LENGTH;
}

export function isValidNodeId(raw: string): boolean {
  return isValidEntityId(raw) && NODE_ID_PATTERN.test(raw);
}

export function isValidIdSeed(raw: string): boolean {
  return ID_SEED_PATTERN.test(raw);
}

/*
 * Brand constructors: the casts are only permitted here. Infrastructure
 * calls `to…` for ids read from storage; request values go through `parse…`.
 */
export function toPageId(raw: string): PageId {
  return raw as PageId;
}

export function toPageNodeId(raw: string): PageNodeId {
  return raw as PageNodeId;
}

export function toWebsiteId(raw: string): WebsiteId {
  return raw as WebsiteId;
}

/**
 * The one place the id format lives: `<type>-<seed>-<ordinal>`. The same
 * input and seed always yield the same id; no clock or randomness is involved.
 */
export function deriveNodeId(type: string, seed: string, ordinal: number): PageNodeId {
  return toPageNodeId(`${type}-${seed}-${ordinal}`);
}

export const parsePageId = createIdParser({
  isValid: isValidEntityId,
  brand: toPageId,
  mapError: () => fieldValidationFailed('pageId', CODES.idInvalid),
});

export const parseWebsiteId = createIdParser({
  isValid: isValidEntityId,
  brand: toWebsiteId,
  mapError: () => fieldValidationFailed('websiteId', CODES.idInvalid),
});

export const parsePageNodeId = createIdParser({
  isValid: isValidNodeId,
  brand: toPageNodeId,
  mapError: () => fieldValidationFailed('nodeId', CODES.nodeIdInvalid),
});

/** The seed stays a plain string: it is never stored, only mixed into node ids. */
export const parseIdSeed = createIdParser({
  isValid: isValidIdSeed,
  brand: identity,
  mapError: () => fieldValidationFailed('idSeed', CODES.idSeedInvalid),
});
