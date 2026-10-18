import type {
  PageChangeKindView,
  PublicationStatusView,
} from '../../application/contracts/release-views';

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

type Draft = Pick<
  PublicationStatusView['draft'],
  'pageChangeCount' | 'websiteChanged' | 'themeChanged'
>;

/** The website-wide changes waiting besides pages, as the keys of their names. */
export function settingsChangeKeys(draft: Draft): ReadonlyArray<'website' | 'theme'> {
  return [
    ...(draft.websiteChanged ? (['website'] as const) : []),
    ...(draft.themeChanged ? (['theme'] as const) : []),
  ];
}

/** Every change a publish would make live: the pages and the website's details and theme. */
export function changeCountOf(draft: Draft): number {
  return draft.pageChangeCount + settingsChangeKeys(draft).length;
}
