/**
 * What the editor offers for the booking component's service and category: the website's running
 * services and the categories they use. The route builds it from the booking module; the builder
 * only displays it, so it never depends on that module.
 */
export interface BookingChoicesDto {
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly category: string | null;
  }>;
  readonly categories: readonly string[];
}

/** The choices when the booking module cannot answer: the dropdowns offer "all" and nothing else. */
export const NO_BOOKING_CHOICES: BookingChoicesDto = { services: [], categories: [] };
