/** One physical resource a location assigns to the service. */
export interface ServiceResourceInput {
  readonly resourceId: string;
  /** Required: the slot needs it. Optional: used if free, never needed. */
  readonly isRequired: boolean;
}

/**
 * What a caller sends to define a service at a location, as plain values and untrusted until
 * `parseServiceInput` has read it. Lengths are whole minutes (days for the horizon). Nothing names a
 * website, a tenant or a person. Some of it belongs to the service everywhere that offers it
 * (`shared`), some to this location alone (`local`); the use case, not the caller, tells them apart.
 */
export interface ServiceInput {
  // Allgemein
  /** shared */
  readonly name: string;
  /** shared: the text a citizen reads. */
  readonly description: string;
  /** shared */
  readonly category: string;
  /** shared: short items, shown in the confirmation. */
  readonly documents: readonly string[];
  /** shared: shown in the confirmation. */
  readonly instructions: string;
  /** shared, managers only. */
  readonly internalNote: string;
  /** local */
  readonly isOnlineBookable: boolean;
  /** local */
  readonly isActive: boolean;
  // Dauer & Puffer (shared)
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  // Ressourcen (local)
  readonly resources: readonly ServiceResourceInput[];
  // Regeln & Rechte (shared)
  /** How long before the appointment booking closes. */
  readonly noticeMinutes: number;
  /** How many days ahead a booking may be made. */
  readonly horizonDays: number;
  readonly cancelUntilMinutes: number;
  readonly changeUntilMinutes: number;
  /** Who may cancel and change: `customer`, `employee`, `manager`. */
  readonly actors: readonly string[];
  /** `none`, `any` or `qualified`. */
  readonly employee: string;
  /** The qualification, when `employee` is `qualified`. */
  readonly qualification: string;
}

export interface CreateServiceInput extends ServiceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
}

export interface UpdateServiceInput extends ServiceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  /** The `version` of the `ServiceView` the form was filled from (the shared definition). */
  readonly expectedVersion: string;
  /** The `settingVersion` of the same view (this location's part). */
  readonly expectedSettingVersion: string;
  /**
   * The manager knows a change to the shared definition reaches every location that has the service.
   * Without it such a change is refused.
   */
  readonly acknowledgeShared: boolean;
}

export interface GetServiceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
}

export interface GetServiceFormOptionsInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
}

export interface ListServicesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly search?: string | undefined;
  readonly category?: string | undefined;
  /** `own`, `copy` or `linked`; none: all. */
  readonly origin?: string | undefined;
  /** `active`, `inactive`; none: both. */
  readonly status?: string | undefined;
  /** The page of categories asked for: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page?: unknown; readonly pageSize?: unknown };
}

export interface ListAdoptableServicesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly search?: string | undefined;
  /** Only services that this location has switched on. */
  readonly sourceLocationId?: string | undefined;
  readonly page: { readonly page?: unknown; readonly pageSize?: unknown };
}

export interface ListOfferableServicesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
}

export interface AdoptServiceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  /** The location it was picked from: where a copy says it came from. */
  readonly sourceLocationId: string;
  /** `copy` or `link`. */
  readonly mode: string;
}

export interface PreviewServiceDeactivationInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  /** `location` or `all`. */
  readonly scope: string;
}

export interface ServiceResolutionInput {
  readonly bookingId: string;
  /** `leave` or `cancel`. */
  readonly kind: string;
}

export interface DeactivateServiceInput extends PreviewServiceDeactivationInput {
  /** `block-new`: existing bookings stay valid. `review`: every booking gets a decision. */
  readonly mode: string;
  readonly resolutions: readonly ServiceResolutionInput[];
  readonly expectedVersion: string;
  readonly expectedSettingVersion: string;
}

export interface ReactivateServiceInput extends PreviewServiceDeactivationInput {
  readonly expectedVersion: string;
  readonly expectedSettingVersion: string;
}
