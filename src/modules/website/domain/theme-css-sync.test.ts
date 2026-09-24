import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { themeToCssVariables, defaultTheme } from "./theme";
import { contrastRatio, PAGE_BACKGROUND } from "./contrast";

/**
 * globals.css and the theme domain both define color values and cannot share
 * a source (CSS vs TypeScript). These tests are the seam: they fail when one
 * side changes without the other, and they pin the accessibility claims made
 * about the static platform tokens so a future tweak cannot quietly break them.
 */

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function rootTokens(): Record<string, string> {
    const block = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    if (!block) throw new Error("No :root block found in globals.css");
    const tokens: Record<string, string> = {};
    for (const m of block[1].matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) tokens[m[1]] = m[2].trim();
    return tokens;
}

const root = rootTokens();
const token = (name: string): string => {
    const value = root[name];
    if (!value) throw new Error(`${name} is not defined in :root`);
    return value.toLowerCase();
};

describe("globals.css :root vs the default theme", () => {
    it("mirrors every color variable themeToCssVariables emits for the default theme", () => {
        const emitted = themeToCssVariables(defaultTheme);
        const colorKeys = Object.keys(emitted).filter((k) => k.startsWith("--civo-color-"));
        expect(colorKeys.length).toBeGreaterThanOrEqual(9);
        for (const key of colorKeys) {
            expect(token(key), key).toBe(emitted[key].toLowerCase());
        }
    });

    it("uses the same page background the contrast helpers assume", () => {
        expect(token("--civo-color-background")).toBe(PAGE_BACKGROUND);
    });
});

describe("static platform tokens meet WCAG", () => {
    const background = token("--civo-color-background");
    const surface = token("--civo-color-surface");

    it("body and muted text meet 4.5:1 on both page surfaces", () => {
        for (const name of ["--civo-color-text", "--civo-color-text-muted"]) {
            expect(contrastRatio(token(name), background), `${name} on background`).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(token(name), surface), `${name} on surface`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("each status color is legible as text on the page, on cards, and on its own tinted background", () => {
        for (const status of ["success", "warning", "danger", "info"]) {
            const solid = token(`--civo-color-${status}`);
            const subtle = token(`--civo-color-${status}-subtle`);
            expect(contrastRatio(solid, background), `${status} on background`).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(solid, surface), `${status} on surface`).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(solid, subtle), `${status} on subtle`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("the control border meets the 3:1 non-text minimum on both surfaces (WCAG 1.4.11)", () => {
        const strong = token("--civo-color-border-strong");
        expect(contrastRatio(strong, surface), "on surface").toBeGreaterThanOrEqual(3);
        expect(contrastRatio(strong, background), "on background").toBeGreaterThanOrEqual(3);
    });
});

describe("tokens derived from a themable token must re-resolve per website", () => {
    // `var()` inside a custom property resolves where it is DECLARED. A token
    // derived from a themable color and declared only on :root captures the
    // default theme forever: the site's ThemeProvider overrides the source
    // color on its own wrapper, and the derived token never sees it. This
    // shipped once (charts ignored the site's brand colors), hence the test.
    const themable = new Set(Object.keys(themeToCssVariables(defaultTheme)));

    it("no plain :root declaration is derived from a themable token", () => {
        const offenders = Object.entries(root)
            .filter(([, value]) => [...value.matchAll(/var\((--[a-z0-9-]+)/g)].some((m) => themable.has(m[1])))
            .map(([name]) => name);
        expect(offenders, "declare these on `:root, [data-civo-theme]` instead").toEqual([]);
    });

    it("re-derives the chart palette on [data-civo-theme] as well as :root", () => {
        const rule = css.match(/:root,\s*\[data-civo-theme\]\s*\{([\s\S]*?)\n\}/);
        expect(rule, "expected a `:root, [data-civo-theme]` rule").not.toBeNull();
        for (const n of [1, 2, 3, 4, 5, 6]) expect(rule![1], `--civo-chart-${n}`).toContain(`--civo-chart-${n}:`);
    });
});
