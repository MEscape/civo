import { AlertBanner } from '../civic/alert-banner/alert-banner';
import { BookingBlock } from '../civic/booking/booking-block';
import { ContactCard } from '../civic/contact-card/contact-card';
import { CouncilBlock } from '../civic/council-block/council-block';
import { DepartmentDirectory } from '../civic/department-directory/department-directory';
import { EventsGrid } from '../civic/events-grid/events-grid';
import { NewsAndEventsSplit } from '../civic/news-and-events-split/news-and-events-split';
import { NewsGrid } from '../civic/news-grid/news-grid';
import { OpeningHours } from '../civic/opening-hours/opening-hours';
import { QuickLinks } from '../civic/quick-links/quick-links';
import { ServiceFinder } from '../civic/service-finder/service-finder';
import { ServiceGrid } from '../civic/service-grid/service-grid';
import { WasteCalendar } from '../civic/waste-calendar/waste-calendar';

import { implementComponent } from './component-implementation';

import type { ComponentImplementation } from './component-implementation';
import type { RegisteredComponentName } from '../../../application/contracts/component-platform-constraints';

/** The civic components: municipal content, some of it loaded from datasets. */
export const CIVIC_IMPLEMENTATIONS = {
  alertBanner: implementComponent('alertBanner', {
    render: ({ props, context, loadContent }) => (
      <AlertBanner props={props} context={context} loadContent={loadContent} />
    ),
  }),
  contactCard: implementComponent('contactCard', {
    render: ({ props, context, loadContent }) => (
      <ContactCard props={props} context={context} loadContent={loadContent} />
    ),
  }),
  councilBlock: implementComponent('councilBlock', {
    render: ({ props, context, loadContent }) => (
      <CouncilBlock props={props} context={context} loadContent={loadContent} />
    ),
  }),
  departmentDirectory: implementComponent('departmentDirectory', {
    render: ({ props, context, loadContent }) => (
      <DepartmentDirectory props={props} context={context} loadContent={loadContent} />
    ),
  }),
  eventsGrid: implementComponent('eventsGrid', {
    render: ({ props, context, loadContent }) => (
      <EventsGrid props={props} context={context} loadContent={loadContent} />
    ),
  }),
  newsAndEventsSplit: implementComponent('newsAndEventsSplit', {
    render: ({ props, context, loadContent }) => (
      <NewsAndEventsSplit props={props} context={context} loadContent={loadContent} />
    ),
  }),
  newsGrid: implementComponent('newsGrid', {
    render: ({ props, context, loadContent }) => (
      <NewsGrid props={props} context={context} loadContent={loadContent} />
    ),
  }),
  openingHours: implementComponent('openingHours', {
    render: ({ props, context, loadContent }) => (
      <OpeningHours props={props} context={context} loadContent={loadContent} />
    ),
  }),
  quickLinks: implementComponent('quickLinks', {
    render: ({ props }) => <QuickLinks props={props} />,
  }),
  serviceFinder: implementComponent('serviceFinder', {
    render: ({ props, context, loadContent }) => (
      <ServiceFinder props={props} context={context} loadContent={loadContent} />
    ),
  }),
  serviceGrid: implementComponent('serviceGrid', {
    render: ({ props, context, loadContent }) => (
      <ServiceGrid props={props} context={context} loadContent={loadContent} />
    ),
  }),
  wasteCalendar: implementComponent('wasteCalendar', {
    render: ({ props, context, loadContent }) => (
      <WasteCalendar props={props} context={context} loadContent={loadContent} />
    ),
  }),
  // smartcity
  booking: implementComponent('booking', {
    render: ({ props, context, bookingSection }) => (
      <BookingBlock props={props} context={context} bookingSection={bookingSection} />
    ),
  }),
} as const satisfies Partial<Record<RegisteredComponentName, ComponentImplementation>>;
