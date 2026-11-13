/**
 * The booking actions' answers. The application's views are already safe to hand to the browser: ids, ISO-8601 text on the
 * location's wall clock with its offset, closed vocabularies and codes, never a `Date`, a persistence type
 * or localized text. So these DTOs ARE those views, named here to give the browser one stable place to
 * import them from; a field that is not meant for the browser is removed from the view, not hidden here.
 */
export type {
  AssignmentCandidatesView as AssignmentCandidatesDto,
  AvailableSlotsView as AvailableSlotsDto,
  BookingCalendarView as BookingCalendarDto,
  BookingDetailView as BookingDetailDto,
  BookingView as BookingDto,
  BookingNamesView as BookingNamesDto,
  BookingPageView as BookingPageDto,
  EmployeeBookingView as EmployeeBookingDto,
  OpenBookingView as OpenBookingDto,
  OwnChangeView as OwnChangeDto,
  PublicBookingView as PublicBookingDto,
} from '../../application/contracts/booking-views';
