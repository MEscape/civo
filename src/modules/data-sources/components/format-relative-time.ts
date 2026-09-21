const relativeTimeFormatter = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
];

/** Formats a past Date as a German relative time string, e.g. "vor 2 Minuten". */
export function formatRelativeTime(date: Date): string {
    const diffSeconds = (date.getTime() - Date.now()) / 1000;

    for (const { unit, seconds } of UNITS) {
        if (Math.abs(diffSeconds) >= seconds) {
            return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
        }
    }
    return relativeTimeFormatter.format(Math.round(diffSeconds), "second");
}
