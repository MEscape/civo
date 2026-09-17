import type { ComponentDefinition } from "@/modules/component-platform/domain/types";
import { newsGridDefinition } from "./news-grid/news-grid.definition";
import { eventsGridDefinition } from "./events-grid/events-grid.definition";
import { serviceGridDefinition } from "./service-grid/service-grid.definition";
import { contactCardDefinition } from "./contact-card/contact-card.definition";
import { openingHoursDefinition } from "./opening-hours/opening-hours.definition";
import { quickLinksDefinition } from "./quick-links/quick-links.definition";
import { locationPlaceholderDefinition } from "./location-placeholder/location-placeholder.definition";
import { serviceFinderDefinition } from "./service-finder/service-finder.definition";
import { alertBannerDefinition } from "./alert-banner/alert-banner.definition";
import { councilBlockDefinition } from "./council-block/council-block.definition";
import { wasteCalendarDefinition } from "./waste-calendar/waste-calendar.definition";
import { newsAndEventsSplitDefinition } from "./news-and-events-split/news-and-events-split.definition";
import { departmentDirectoryDefinition } from "./department-directory/department-directory.definition";

export const civicComponents: ComponentDefinition<any>[] = [
    newsGridDefinition,
    eventsGridDefinition,
    serviceGridDefinition,
    contactCardDefinition,
    openingHoursDefinition,
    quickLinksDefinition,
    locationPlaceholderDefinition,
    serviceFinderDefinition,
    alertBannerDefinition,
    councilBlockDefinition,
    wasteCalendarDefinition,
    newsAndEventsSplitDefinition,
    departmentDirectoryDefinition,
];
