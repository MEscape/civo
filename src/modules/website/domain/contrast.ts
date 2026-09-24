/**
 * WCAG 2.x color contrast, used to keep text readable on whatever brand
 * colors a municipality picks. Pure functions, no dependencies.
 */

/** Text color on dark brand colors. */
export const LIGHT_FOREGROUND = "#ffffff";
/**
 * Text color on light brand colors. Pure black, not a softer near-black, on
 * purpose: white-or-black is guaranteed >= 4.58:1 on every possible
 * background, but a near-black such as #111 dips below the 4.5:1 AA
 * threshold for mid-tone backgrounds (see contrast.test.ts).
 */
export const DARK_FOREGROUND = "#000000";

/**
 * The darkest page surface text can sit on: --civo-color-background in
 * globals.css (cards use the lighter --civo-color-surface). Text that meets
 * the ratio here meets it on every surface. A test keeps this in sync with
 * the CSS, because the two cannot share a source.
 */
export const PAGE_BACKGROUND = "#f6f4ee";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function channelLuminance(value: number): number {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0 = black, 1 = white) of a `#rrggbb` color. Throws on any other format. */
export function relativeLuminance(hex: string): number {
    if (!HEX_COLOR.test(hex)) {
        throw new Error(`Expected a #rrggbb color, got "${hex}".`);
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two `#rrggbb` colors, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
    const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The text color (white or black) with the higher contrast on `background`.
 * Never throws: an unparseable color falls back to white, the behavior
 * before this existed, so bad stored theme data can't break rendering.
 */
export function readableForeground(background: string): string {
    if (!HEX_COLOR.test(background)) return LIGHT_FOREGROUND;
    return contrastRatio(LIGHT_FOREGROUND, background) >= contrastRatio(DARK_FOREGROUND, background)
        ? LIGHT_FOREGROUND
        : DARK_FOREGROUND;
}

const DARKEN_STEP = 0.02;

function toHex(channel: number): string {
    return Math.round(channel).toString(16).padStart(2, "0");
}

/**
 * A brand color that is readable as text or an icon on `background`.
 *
 * A color that already meets `minRatio` (default 4.5:1, WCAG AA for body
 * text) is returned exactly as given, so compliant brand colors are never
 * touched. Otherwise it is mixed toward black in 2% steps and the first
 * step that meets the ratio is returned: the smallest change that
 * passes, keeping the hue the municipality chose. Only darkens, so it is for
 * light backgrounds. Black reaches 21:1 on any light background, so the search
 * always ends. An unparseable color is returned unchanged.
 */
export function ensureContrast(color: string, background: string, minRatio = 4.5): string {
    if (!HEX_COLOR.test(color) || !HEX_COLOR.test(background)) return color;
    if (contrastRatio(color, background) >= minRatio) return color;

    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    for (let amount = DARKEN_STEP; amount < 1; amount += DARKEN_STEP) {
        const keep = 1 - amount;
        const candidate = `#${toHex(r * keep)}${toHex(g * keep)}${toHex(b * keep)}`;
        if (contrastRatio(candidate, background) >= minRatio) return candidate;
    }
    return "#000000";
}
