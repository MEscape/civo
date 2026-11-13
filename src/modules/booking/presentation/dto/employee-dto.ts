/**
 * The employee's own area: plan, inbox and preferences. The application's views are already safe to hand to the browser: ids, ISO-8601 text on the
 * location's wall clock with its offset, closed vocabularies and codes, never a `Date`, a persistence type
 * or localized text. So these DTOs ARE those views, named here to give the browser one stable place to
 * import them from; a field that is not meant for the browser is removed from the view, not hidden here.
 */
export type {
  DayPlanView as DayPlanDto,
  DayPlanItemView as DayPlanItemDto,
  MarkedReadView as MarkedReadDto,
  MessageView as MessageDto,
  MessagePageView as MessagePageDto,
  PreferencesView as PreferencesDto,
  SavedPreferencesView as SavedPreferencesDto,
} from '../../application/contracts/employee-views';
