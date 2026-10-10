import type { ComponentType } from 'react';

import type { BookingSectionProps } from '@modules/booking';

import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';

export interface BookingBlockProps {
  readonly props: ComponentProps<'booking'>;
  readonly context: RenderContext;
  /** The booking module's section, handed in by `composition.ts`. */
  readonly bookingSection: ComponentType<BookingSectionProps>;
}

/** The editor's mode names, in the booking module's words. */
const SECTION_MODE = {
  public: 'public',
  adminCalendar: 'admin',
} as const satisfies Record<ComponentProps<'booking'>['mode'], BookingSectionProps['mode']>;

/**
 * Places the booking module's screens on a page. The component platform owns
 * only WHERE booking appears and WHICH services a visitor may choose from;
 * the booking module owns availability, holds and every rule. The website is
 * read from the render context, never from a prop an editor could change.
 */
export async function BookingBlock({
  props,
  context,
  bookingSection: BookingSection,
}: BookingBlockProps) {
  const t = await getTranslations('componentPlatform');
  const heading = trimToNull(props.heading) ?? t('booking.defaultHeading');

  return (
    <Section>
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <BookingSection
          websiteId={context.websiteId}
          mode={SECTION_MODE[props.mode]}
          renderMode={context.mode}
          heading={heading}
          serviceId={trimToNull(props.serviceId) ?? undefined}
          category={trimToNull(props.category) ?? undefined}
        />
      </Container>
    </Section>
  );
}
