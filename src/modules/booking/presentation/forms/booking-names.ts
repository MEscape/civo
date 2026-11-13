import type { BookingDto, BookingNamesDto } from '../dto/booking-dto';

/** The names a booking is shown with, looked up by id; `unknown` for what is gone. */
export interface NameBook {
  readonly location: (id: string) => string;
  readonly service: (id: string) => string;
  readonly resource: (id: string) => string;
}

export function nameBookOf(names: BookingNamesDto, unknown: string): NameBook {
  const index = (rows: ReadonlyArray<{ readonly id: string; readonly name: string }>) =>
    new Map(rows.map((row) => [row.id, row.name]));
  const locations = index(names.locations);
  const services = index(names.services);
  const resources = index(names.resources);
  return {
    location: (id) => locations.get(id) ?? unknown,
    service: (id) => services.get(id) ?? unknown,
    resource: (id) => resources.get(id) ?? unknown,
  };
}

/** One unit of a booking as a screen lists it. */
export interface UnitLine {
  readonly requirementIndex: number;
  readonly isEmployee: boolean;
  /** `null`: an employee unit nobody serves yet. */
  readonly resourceId: string | null;
  readonly name: string | null;
}

export function unitLinesOf(booking: Pick<BookingDto, 'units'>, book: NameBook): UnitLine[] {
  return booking.units.map((unit) => ({
    requirementIndex: unit.requirementIndex,
    isEmployee: unit.resourceType === 'employee',
    resourceId: unit.resourceId,
    name: unit.resourceId === null ? null : book.resource(unit.resourceId),
  }));
}

/** The employees serving a booking, by name. */
export const staffNamesOf = (booking: Pick<BookingDto, 'units'>, book: NameBook) =>
  unitLinesOf(booking, book).flatMap((line) =>
    line.isEmployee && line.name !== null ? [line.name] : [],
  );

/** "Becker, Julia" from what the citizen gave; `null` when they gave no name. */
export function customerNameOf(customer: BookingDto['customer']): string | null {
  const parts = [customer?.lastName, customer?.firstName].filter(
    (part): part is string => part !== undefined && part !== '',
  );
  return parts.length === 0 ? null : parts.join(', ');
}

/** The display state of a booking (BD-04): its status, a confirmed one told apart by its assignment. */
export const displayStateOf = (booking: Pick<BookingDto, 'status' | 'assignment'>) =>
  booking.status === 'confirmed' ? booking.assignment : booking.status;
