import { Container, Section } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

export interface HeroComponentProps {
  readonly props: ComponentProps<'hero'>;
}

/** A large title area with title, subtitle and an optional faint image. */
export async function Hero({ props }: HeroComponentProps) {
  const t = await getTranslations('componentPlatform');
  const title = trimToNull(props.title) ?? t('hero.defaultTitle');
  const subtitle = trimToNull(props.subtitle);
  const imageUrl = trimToNull(props.imageUrl);

  return (
    <Section className="relative overflow-hidden">
      {imageUrl !== null && (
        // eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-10"
        />
      )}
      <Container className="relative">
        <h1 className="max-w-3xl font-heading text-4xl leading-tight text-primary-copy sm:text-5xl">
          {title}
        </h1>
        {subtitle !== null && <p className="mt-4 max-w-xl text-lg text-copy-muted">{subtitle}</p>}
      </Container>
    </Section>
  );
}
