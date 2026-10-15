import type { PageChangeKindView } from '../../application/contracts/release-views';

/** How a changed page is marked wherever changes are listed: the same words and colours everywhere. */
export const CHANGE_KIND_VARIANTS = {
  added: 'success',
  changed: 'info',
  removed: 'danger',
} as const satisfies Record<PageChangeKindView, 'success' | 'info' | 'danger'>;

export const CHANGE_KIND_KEYS = {
  added: 'publication.kind.added',
  changed: 'publication.kind.changed',
  removed: 'publication.kind.removed',
} as const satisfies Record<PageChangeKindView, string>;
