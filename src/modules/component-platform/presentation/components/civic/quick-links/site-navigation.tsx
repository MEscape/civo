import { Container } from '@components/layout/layout-primitives';
import { ContentLink } from '@components/ui/content-link';

import { getTranslations } from '@i18n/server';

import { SiteMenu } from './site-menu.client';

import type { ComponentProps } from '../../../../application/contracts/component-platform-constraints';

/** Compact site chrome uses the same stored link contract as the existing content list. */
export async function SiteNavigation({ props }: { readonly props: ComponentProps<'quickLinks'> }) {
  const t = await getTranslations('componentPlatform');
  if (props.placement === 'header') {
    return (
      <header className="relative border-b border-border bg-surface print:hidden">
        <Container>
          <ContentLink
            href="#published-content"
            className="sr-only focus:not-sr-only focus:block focus:py-3"
          >
            {t('quickLinks.skipToContent')}
          </ContentLink>
          <div className="flex items-center justify-between gap-x-6 py-2 lg:gap-x-10 lg:py-4">
            <ContentLink
              href={props.links[0]?.href ?? '#published-content'}
              className="inline-flex min-h-11 min-w-0 items-center font-heading text-2xl font-semibold tracking-tight text-primary-copy [overflow-wrap:anywhere]"
            >
              {props.heading}
            </ContentLink>
            <SiteMenu
              links={props.links}
              label={t('quickLinks.mainNavigation')}
              menuLabel={t('quickLinks.menu')}
            />
          </div>
        </Container>
      </header>
    );
  }
  const Tag = props.placement === 'footer' ? 'footer' : 'header';
  return (
    <Tag className="border-t border-border bg-surface py-10 print:hidden">
      <Container>
        <div className="grid gap-8 md:grid-cols-3">
          <strong className="flex min-h-11 items-center self-start font-heading text-xl text-primary-copy [overflow-wrap:anywhere]">
            {props.heading}
          </strong>
          <nav className="md:col-span-2" aria-label={t('quickLinks.footerNavigation')}>
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {props.links.map((link) => (
                <li key={link.href}>
                  <ContentLink
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-copy underline-offset-4 hover:underline [overflow-wrap:anywhere]"
                  >
                    {link.label}
                  </ContentLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </Tag>
  );
}
