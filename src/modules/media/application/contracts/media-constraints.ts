/**
 * Domain constants and codes that presentation legitimately needs (form validation, message
 * lookup). Presentation may not import the domain, so they are re-exported here as part of the
 * application's contract. Nothing in this file is defined twice.
 */
export { MEDIA_ERROR_CODES, MEDIA_VALIDATION_CODES } from '../../domain/errors/media-errors';
export type { MediaCode } from '../../domain/errors/media-errors';
export { MEDIA_FORMATS } from '../../domain/models/media-format';
export type { MediaFormat } from '../../domain/models/media-format';
export { MEDIA_LIMITS, MEDIA_VISIBILITIES } from '../../domain/models/media-asset';
export type { MediaVisibility } from '../../domain/models/media-asset';
export { MEDIA_PICKER_PAGE_SIZE } from '../media-limits';
export { DEFAULT_MEDIA_SORT, MEDIA_SORT_FIELDS } from '../../domain/ports/media-asset.repository';
export type { MediaSortField } from '../../domain/ports/media-asset.repository';
