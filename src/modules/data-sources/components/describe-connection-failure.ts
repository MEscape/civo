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
 */
export function describeConnectionFailure(
    category: ConnectionDiagnosticCategory | string,
    message: string
): string {
    switch (category) {
        case "AUTHENTICATION_FAILED":
            return `Authentifizierung fehlgeschlagen: ${message}`;
        case "INVALID_RESPONSE":
            return `Ungültige Antwort: ${message}`;
        case "INVALID_CONFIGURATION":
            return `Ungültige Konfiguration: ${message}`;
        default:
            return `Verbindung fehlgeschlagen: ${message}`;
    }
}
