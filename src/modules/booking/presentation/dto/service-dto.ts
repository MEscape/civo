/**
 * Services: what the actions answer with and what the service form sends. The application's views are already safe to hand to the browser: ids, ISO-8601 text on the
 * location's wall clock with its offset, closed vocabularies and codes, never a `Date`, a persistence type
 * or localized text. So these DTOs ARE those views, named here to give the browser one stable place to
 * import them from; a field that is not meant for the browser is removed from the view, not hidden here.
 */
export type {
  AdoptablePageView as AdoptablePageDto,
  AdoptableServiceView as AdoptableServiceDto,
  BookingChoicesView as BookingChoicesDto,
  DeactivationImpactView as DeactivationImpactDto,
  LocationNameView as LocationNameDto,
  ResourceOptionView as ResourceOptionDto,
  ServiceBookingView as ServiceBookingDto,
  ServiceView as ServiceDto,
  ServiceFormOptionsView as ServiceFormOptionsDto,
  ServiceGroupView as ServiceGroupDto,
  ServiceOriginView as ServiceOriginDto,
  ServicePageView as ServicePageDto,
  ServiceResourceView as ServiceResourceDto,
  ServiceSummaryView as ServiceSummaryDto,
} from '../../application/contracts/service-views';
export type {
  ServiceInput as ServiceInputDto,
  ServiceResourceInput as ServiceResourceInputDto,
} from '../../application/contracts/service-inputs';
