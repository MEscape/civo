import type { PublicCatalogDto, PublicServiceDto } from './catalog-dto';

/** The sample texts, already translated by the caller (the booking namespace's `sample.*`). */
export interface SampleCatalogTexts {
  readonly idCard: {
    readonly name: string;
    readonly description: string;
    readonly category: string;
  };
  readonly registration: {
    readonly name: string;
    readonly description: string;
    readonly category: string;
  };
  readonly location: { readonly name: string; readonly address: string };
  readonly instructions: string;
}

const SAMPLE_TIME_ZONE = 'Europe/Berlin';
const SAMPLE_DURATION_MINUTES = 20;
const SAMPLE_HORIZON_DAYS = 60;
const SAMPLE_CANCELLATION_DEADLINE_MINUTES = 1_440;

/**
 * Placeholder services for the editor canvas and the palette preview while
 * no real service is active, so an editor sees what the component will look
 * like. Never reachable on a published page, and the flow runs read-only.
 */
export function createSampleCatalog(texts: SampleCatalogTexts): PublicCatalogDto {
  const location = {
    id: 'sample-location',
    name: texts.location.name,
    address: texts.location.address,
    timeZone: SAMPLE_TIME_ZONE,
  };
  const base = {
    locations: [location],
    maxParticipantsPerBooking: 1,
    information: [
      { field: 'firstName', isRequired: true },
      { field: 'lastName', isRequired: true },
      { field: 'email', isRequired: true },
    ],
    requiredDocuments: [],
    instructions: texts.instructions,
    durationMinutes: SAMPLE_DURATION_MINUTES,
    horizonDays: SAMPLE_HORIZON_DAYS,
    cancellationAllowed: true,
    cancellationDeadlineMinutes: SAMPLE_CANCELLATION_DEADLINE_MINUTES,
  } as const satisfies Partial<PublicServiceDto>;

  return {
    services: [
      { ...base, id: 'sample-id-card', ...texts.idCard },
      { ...base, id: 'sample-registration', ...texts.registration },
    ],
  };
}
