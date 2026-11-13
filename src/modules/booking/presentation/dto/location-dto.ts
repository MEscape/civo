/**
 * Locations: what the actions answer with and what the location form sends. The application's views are already safe to hand to the browser: ids, ISO-8601 text on the
 * location's wall clock with its offset, closed vocabularies and codes, never a `Date`, a persistence type
 * or localized text. So these DTOs ARE those views, named here to give the browser one stable place to
 * import them from; a field that is not meant for the browser is removed from the view, not hidden here.
 */
export type {
  AffectedBookingView as AffectedBookingDto,
  ExceptionView as ExceptionDto,
  LocationView as LocationDto,
  LocationImpactView as LocationImpactDto,
  LocationPageView as LocationPageDto,
  LocationSummaryView as LocationSummaryDto,
} from '../../application/contracts/location-views';
export type {
  DayInput as DayDto,
  ExceptionInput as ExceptionInputDto,
  LocationInput as LocationInputDto,
  RangeInput as RangeDto,
} from '../../application/contracts/location-inputs';
