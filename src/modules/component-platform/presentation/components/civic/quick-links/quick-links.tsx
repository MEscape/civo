import { ArrowRight } from '@components/icons/icons';
import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';
import { ContentLink } from '@components/ui/content-link';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { SiteNavigation } from './site-navigation';

import type { ComponentProps } from '../../../../application/contracts/component-platform-constraints';

export interface QuickLinksComponentProps {
  readonly props: ComponentProps<'quickLinks'>;
}

/** A short list of important links. */
export async function QuickLinks({ props }: QuickLinksComponentProps) {
  if (props.links.length === 0) {
    return null;
  }
  if (props.placement === 'header' || props.placement === 'footer') {
    return <SiteNavigation props={props} />;
  }
  const t = await getTranslations('componentPlatform');
  const heading = trimToNull(props.heading) ?? t('quickLinks.defaultHeading');

  return (
    <Section tone="muted">
      <Container>
        <Rail heading={heading} ratio="balanced">
          <ul className="divide-y divide-border border-y border-border">
            {props.links.map((link, index) => (
              <li key={`${String(index)}-${link.href}`}>
                <ContentLink
                  href={link.href}
                  className="group flex items-center justify-between gap-4 py-4 text-base font-medium text-copy transition-interactive hover:text-primary-copy"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{link.label}</span>
                  <ArrowRight
                    className="size-4 shrink-0 transition-interactive group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                    aria-hidden="true"
                  />
                </ContentLink>
              </li>
            ))}
          </ul>
        </Rail>
      </Container>
    </Section>
  );
}
