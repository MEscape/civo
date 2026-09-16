/**
 * Zod schemas mirroring the canonical content domain types.
 *
 * These are used to validate data coming out of adapters (external API
 * responses, mock data, database rows) BEFORE it is trusted anywhere else
 * in the application. See src/modules/integrations/civic/infrastructure/adapters.
 * 
 * Note: Schemas have been split by domain for maintainability.
 */

export * from "./civic-schema";
export * from "./smartcity-schema";
