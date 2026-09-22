/**
 * Canonical internal content model.
 *
 * These types are the ONLY shapes UI components are allowed to depend on.
 * External data (REST, municipal/smart-city APIs, CMS, database
 * rows) is mapped into these shapes at the data-adapter boundary — see
 * `src/modules/integrations/*\/infrastructure/adapters`. Components must
 * never import provider-specific types.
 *
 *   External data ≠ internal data ≠ UI props
 *
 * Note: Types have been split by domain for maintainability. This file
 * remains as a stable barrel so existing imports keep working; prefer
 * importing directly from `civic-types` / `smartcity-types` in new code.
 */

export * from "./civic-types";
export * from "./smartcity-types";
