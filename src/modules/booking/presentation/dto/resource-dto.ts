/**
 * Resources: what the actions answer with and what the resource form sends. The application's views are already safe to hand to the browser: ids, ISO-8601 text on the
 * location's wall clock with its offset, closed vocabularies and codes, never a `Date`, a persistence type
 * or localized text. So these DTOs ARE those views, named here to give the browser one stable place to
 * import them from; a field that is not meant for the browser is removed from the view, not hidden here.
 */
export type {
  ResourceBlockView as ResourceBlockDto,
  ResourceBusyView as ResourceBusyDto,
  ResourceView as ResourceDto,
  ResourceImpactView as ResourceImpactDto,
  ResourcePageView as ResourcePageDto,
  ResourceStatus as ResourceStatusDto,
  ResourceSummaryView as ResourceSummaryDto,
  ResourceTodayView as ResourceTodayDto,
} from '../../application/contracts/resource-views';
export type {
  CreateResourceInput as CreateResourceInputDto,
  ResourceInput as ResourceInputDto,
} from '../../application/contracts/resource-inputs';
