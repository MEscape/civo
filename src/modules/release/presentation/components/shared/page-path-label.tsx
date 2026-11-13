'use client';

import { useTranslations } from '@i18n/client';

export interface PagePathLabelProps {
  /** The root page has an empty path. */
  readonly path: string;
}

/** A page by its path; the root page has no path to show, so it gets a name. */
export function PagePathLabel({ path }: PagePathLabelProps) {
  const t = useTranslations('release');

  return path === '' ? t('migration.review.homePage') : `/${path}`;
}
