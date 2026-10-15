'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { usePathname, useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { websiteRoutes } from '../routes';

export interface SwitchableWebsite {
  readonly id: string;
  readonly name: string;
}

export interface WebsiteSwitcherProps {
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
}

const ALL = '__all__';

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
}: WebsiteSwitcherProps) {
  const t = useTranslations('website');
  const pathname = usePathname();
  const router = useRouter();
  const choices = websites.some((website) => website.id === current.id)
    ? websites
    : [current, ...websites];

  function handleChange(value: string) {
    if (value === ALL) {
      router.push(websiteRoutes.list());
      return;
    }
    const section = keepSection ? sectionOf(pathname, current.id) : '';
    router.push(`${websiteRoutes.detail(value)}${section}`);
  }

  return (
    <Select value={current.id} onValueChange={handleChange}>
      <SelectTrigger
        aria-label={t('nav.switch')}
        className="mr-3 h-8 w-auto max-w-56 self-center gap-2 border-transparent bg-transparent px-2 font-heading font-semibold shadow-none hover:bg-canvas"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((website) => (
          <SelectItem key={website.id} value={website.id}>
            {website.name}
          </SelectItem>
        ))}
        {offerList && (
          <>
            <SelectSeparator />
            <SelectItem value={ALL}>{t('nav.allWebsites')}</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
