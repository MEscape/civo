import type { ConnectionDiagnosticCategory } from "@/modules/data-sources/domain/data-source-schema";

/**
 * Maps a connection diagnostic category to a German user-facing prefix for
 * display in the settings UI (spec §6).
 *
 * Colocated in the components folder because it is a pure presentation
 * concern — converting a typed domain value to a display string — with
 * no business logic of its own. Both the data-sources-panel (connection
 * test) and the data-source-mapping-panel (discovery) show the same four
 * category messages, so they share this single function rather than
 * duplicating the switch.
 *
 * Takes only `ConnectionDiagnosticCategory`, not `| string`: widening to
 * `string` would let any typo'd or unhandled category silently fall
 * through to the generic "Verbindung fehlgeschlagen" message with no
 * compiler warning. With the exact union, adding a fifth category to the
 * schema makes this switch a compile error until it is handled here too.
 */
export function describeConnectionFailure(category: ConnectionDiagnosticCategory, message: string): string {
    switch (category) {
        case "AUTHENTICATION_FAILED":
            return `Authentifizierung fehlgeschlagen: ${message}`;
        case "INVALID_RESPONSE":
            return `Ungültige Antwort: ${message}`;
        case "INVALID_CONFIGURATION":
            return `Ungültige Konfiguration: ${message}`;
        case "CONNECTION_FAILED":
            return `Verbindung fehlgeschlagen: ${message}`;
    }
}
