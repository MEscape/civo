import { Container, Section } from '@components/layout/layout-primitives';
import { buttonVariants } from '@components/ui/button';
import { ContentLink } from '@components/ui/content-link';

import { getTranslations } from '@i18n/server';

import { cn, trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

const FALLBACK_HREF = '#';

export interface CallToActionComponentProps {
  readonly props: ComponentProps<'callToAction'>;
}

/**
 * The page's one inverse band: a heading, a sentence, one button. The
 * band's focus ring and print fallback come from `Section tone="inverse"`.
 */
export async function CallToAction({ props }: CallToActionComponentProps) {
  const t = await getTranslations('componentPlatform');
  const heading = trimToNull(props.heading) ?? t('callToAction.defaultHeading');
  const body = trimToNull(props.body);
  const buttonLabel = trimToNull(props.buttonLabel) ?? t('callToAction.defaultButtonLabel');
  const href = trimToNull(props.href) ?? FALLBACK_HREF;

  return (
    <Section tone="inverse" className="@container">
      <Container>
        <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:items-end @3xl:gap-12">
          <div className="min-w-0">
            <h2 className="font-heading text-3xl text-balance sm:text-4xl">{heading}</h2>
            {body !== null && <p className="mt-4 max-w-[var(--civo-measure)] text-lg">{body}</p>}
          </div>
          <ContentLink
            href={href}
            className={cn(
              buttonVariants({ size: 'lg' }),
              // The theme's own on-primary colour as the fill: legible on any brand primary,
              // even when accent equals primary. A long label wraps; 44px for the main action.
              'h-auto min-h-11 justify-self-start bg-primary-foreground py-2 text-start text-base whitespace-normal text-inverse-action-copy hover:bg-primary-foreground hover:underline print:bg-transparent print:text-copy',
            )}
          >
            {buttonLabel}
          </ContentLink>
        </div>
      </Container>
    </Section>
  );
}
