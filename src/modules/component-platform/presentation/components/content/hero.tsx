import { Container, Section } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { cn, trimToNull } from '@lib/utils';

import type {
  ComponentProps,
  RenderContext,
} from '../../../application/contracts/component-platform-constraints';

export interface HeroComponentProps {
  readonly props: ComponentProps<'hero'>;
  /** The resolved image address, if any. Resolution happens in the renderer, which knows the website. */
  readonly imageSrc: string | null;
}

/**
 * Which image the hero shows: the uploaded one if the page names one the website really has,
 * else the external address older pages carry. An uploaded image that cannot be resolved (storage
 * off, or a file that is not this website's) falls back rather than leaving a broken image.
 */
export function heroImageSource(
  props: ComponentProps<'hero'>,
  context: RenderContext,
  mediaUrl: (websiteId: string, assetId: string) => string | null,
): string | null {
  const uploaded = props.image === undefined ? null : mediaUrl(context.websiteId, props.image);
  return uploaded ?? trimToNull(props.imageUrl);
}

/**
 * Title, subtitle and an optional picture. With an image, a wide container
 * puts the text left and lets the picture bleed off the right edge; without
 * one the hero is type alone. The picture is decorative (the contract has no
 * alt text), so it is hidden from assistive technology and from print.
 * The bottom rule ends the page opening: the blocks below often share the
 * hero's canvas and would otherwise run into it.
 */
export async function Hero({ props, imageSrc }: HeroComponentProps) {
  const t = await getTranslations('componentPlatform');
  const title = trimToNull(props.title) ?? t('hero.defaultTitle');
  const subtitle = trimToNull(props.subtitle);

  return (
    <div className="@container relative overflow-hidden border-b border-border">
      <Section>
        <Container>
          <div className={cn(imageSrc !== null && '@4xl:w-7/12 @4xl:pe-12')}>
            <h1 className="max-w-3xl font-heading text-4xl leading-tight tracking-tight text-balance text-primary-copy sm:text-5xl">
              {title}
            </h1>
            {subtitle !== null && (
              <p className="mt-5 max-w-[var(--civo-measure)] text-lg text-copy-muted sm:text-xl">
                {subtitle}
              </p>
            )}
          </div>
        </Container>
      </Section>
      {imageSrc !== null && (
        <div className="relative aspect-[16/9] bg-surface print:hidden @4xl:absolute @4xl:inset-y-0 @4xl:end-0 @4xl:aspect-auto @4xl:w-4/12">
          {/* eslint-disable-next-line @next/next/no-img-element -- the address is an upload on the public media origin or an external link on any host; next/image would need each host allow-listed, and uploads are served straight from the store */}
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
