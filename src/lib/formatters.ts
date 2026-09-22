const relativeTimeFormatter = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
const defaultNumberFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
];

/**
 * Small positive drift (server clock slightly ahead of the browser, or a
 * timestamp recorded a moment ago and only just rendered) is clamped to
 * "now" rather than shown as being in the future. This module always
 * formats a `lastCheckedAt`-style timestamp, which is never legitimately
 * in the future, so this is a display safeguard against skew rather than
 * a general-purpose future-date handler.
 */
const FUTURE_DRIFT_TOLERANCE_SECONDS = 5;

/** Formats a past Date as a German relative time string, e.g. "vor 2 Minuten". */
export function formatRelativeTime(date: Date): string {
    const rawDiffSeconds = (date.getTime() - Date.now()) / 1000;
    const diffSeconds = rawDiffSeconds > 0 && rawDiffSeconds <= FUTURE_DRIFT_TOLERANCE_SECONDS ? 0 : rawDiffSeconds;

    for (const { unit, seconds } of UNITS) {
        if (Math.abs(diffSeconds) >= seconds) {
            return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
        }
    }
    return relativeTimeFormatter.format(Math.round(diffSeconds), "second");
}

/** Formats a number with German formatting, up to 1 decimal place by default. */
export function formatNumber(value: number, fractionDigits: number = 1): string {
    if (fractionDigits === 1) return defaultNumberFormatter.format(value);
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: fractionDigits }).format(value);
}

/** Formats a Date using common preset formats in German. */
export function formatDate(date: Date | string | number, preset: "short" | "long" | "time" | "weekday-short"): string {
    const d = new Date(date);
    switch (preset) {
        case "short":
            // e.g. "21. Sept."
            return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(d);
        case "long":
            // e.g. "21. September 2026"
            return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric" }).format(d);
        case "time":
            // e.g. "14:30"
            return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(d);
        case "weekday-short":
            // e.g. "Mo., 21. Sept."
            return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "short" }).format(d);
        default:
            return new Intl.DateTimeFormat("de-DE").format(d);
    }
}
