'use client';

import { NavDisclosure } from '@components/layout/nav-disclosure';
import { Alert } from '@components/ui/alert';

import { usePathname } from '@i18n';

import { useTranslations } from '@i18n/client';

import { websiteRoutes } from '../routes';

interface SwitchableWebsite {
  readonly id: string;
  readonly name: string;
}

interface WebsiteSwitcherProps {
  readonly current: SwitchableWebsite;
  /** The websites the person can go to, the current one included or not. */
  readonly websites: readonly SwitchableWebsite[];
  /**
   * Whether the same section exists in every website (a platform administrator
   * holds every permission everywhere). Otherwise the other website opens at its
   * start, which sends each person to where their role works.
   */
  readonly keepSection: boolean;
  /** Offer the list of all websites as the last choice. */
  readonly offerList: boolean;
  /** Auth reports when its bounded selector omits websites. */
  readonly isTruncated?: boolean;
}

/** The first part of the path below the website: `releases` for `/websites/<id>/releases/<release>/preview`. */
function sectionOf(pathname: string | null, currentId: string): string {
  const rest = pathname?.split(`/websites/${currentId}`)[1] ?? '';
  const first = rest.split('/')[1];
  return first === undefined || first === '' ? '' : `/${first}`;
}

/**
 * The website's name in the bar, which opens the other websites: choosing one
 * goes straight to it, to the same section when that is valid there. It is the
 * name of the website being managed, so there is never doubt about which one.
 */
export function WebsiteSwitcher({
  current,
  websites,
  keepSection,
  offerList,
  isTruncated = false,
}: WebsiteSwitcherProps) {
  const t = useTranslations('website');
  const pathname = usePathname();
  const choices = websites.some((website) => website.id === current.id)
    ? websites
    : [current, ...websites];

  const section = keepSection ? sectionOf(pathname, current.id) : '';
  const links = choices.map((website) => ({
    href: `${websiteRoutes.detail(website.id)}${section}`,
    label: website.name,
    isCurrent: pathname === `${websiteRoutes.detail(website.id)}${section}`,
  }));

  return (
    <NavDisclosure
      label={
        <>
          <span className="sr-only">{t('nav.switch')}: </span>
          <span className="max-w-24 truncate font-heading font-semibold text-copy sm:max-w-56">
            {current.name}
          </span>
        </>
      }
      links={
        offerList
          ? [
              ...links,
              { href: websiteRoutes.list(), label: t('nav.allWebsites'), isCurrent: false },
            ]
          : links
      }
      isCurrent={false}
      notice={
        isTruncated ? (
          <Alert variant="warning" role="status">
            {t('nav.truncated')}
          </Alert>
        ) : undefined
      }
      className="mr-3 shrink-0 self-stretch"
    />
  );
}
