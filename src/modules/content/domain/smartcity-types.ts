/**
 * Canonical internal content model — smart-city domain.
 *
 * These types are the ONLY shapes UI components are allowed to depend on.
 * External data (REST, GraphQL, municipal/smart-city APIs, CMS, database
 * rows) is mapped into these shapes at the data-adapter boundary — see
 * `src/modules/integrations/smartcity/infrastructure/adapters`. Components
 * must never import provider-specific types.
 *
 *   External data ≠ internal data ≠ UI props
 */

export type SmartCityMetric = {
    id: string;
    label: string;
    value: number;
    unit?: string;
    category?: "sustainability" | "mobility" | "energy" | "other";
    trend?: "up" | "down" | "flat";
    changePercent?: number;
    series?: { date: string; value: number }[];
    breakdown?: { label: string; value: number }[];
    target?: number;
};
