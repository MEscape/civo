import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Enforces the styling rule for this codebase: components style themselves
 * with the design tokens in src/app/globals.css (`bg-primary`, `text-copy`,
 * `rounded-token`, `border-danger-border`, ...), never with raw values.
 *
 * Why a test: a rule that only lives in a document is followed until the
 * first deadline. This one fails the build. If a rule below flags something
 * you believe is legitimate, add a token for it in globals.css instead of
 * bypassing the check; add to ALLOWED_PATHS only for files whose purpose IS
 * to hold raw values.
 */

const SRC = join(process.cwd(), "src");

/** Files that legitimately contain raw values, and why. */
const ALLOWED_PATHS: ReadonlyArray<{ match: (path: string) => boolean; why: string }> = [
    { match: (p) => p === "app/globals.css", why: "defines the tokens" },
    { match: (p) => p.startsWith("modules/website/domain/"), why: "theme values, templates and their validation are data" },
    { match: (p) => p.startsWith("data/"), why: "seed content" },
    { match: (p) => /\.test\.(ts|tsx)$/.test(p), why: "tests describe violations on purpose" },
];

type Rule = { name: string; pattern: RegExp; fix: string };

export const RULES: readonly Rule[] = [
    {
        name: "Tailwind default palette color",
        pattern: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|decoration|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
        fix: "use a token: status colors are success/warning/danger/info (+ -subtle, -border); neutrals are canvas/surface/copy/border",
    },
    {
        name: "literal white/black",
        pattern: /\b(?:bg|text|border|ring|fill|stroke|divide|outline)-(?:white|black)\b/g,
        fix: "use bg-surface / text-copy, or X-foreground for text on a brand color",
    },
    {
        name: "arbitrary value pointing at a --civo token",
        pattern: /[a-z-]+-\[[^\]]*var\(--civo-(?:color|radius|section|font)[^\]]*\]/g,
        fix: "use the registered utility (bg-primary, rounded-token, space-y-section, font-heading)",
    },
    {
        name: "brand color used directly as text or icon color",
        pattern: /(?<![\w-])text-(?:primary|secondary|accent)(?:\/\d+)?(?![\w-])/g,
        fix: "use text-primary-copy / text-secondary-copy / text-accent-copy: the raw brand color is not guaranteed readable",
    },
    {
        name: "raw hex color literal",
        pattern: /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g,
        fix: "add or use a token in globals.css",
    },
    {
        name: "raw rgb()/hsl() color",
        pattern: /\b(?:rgba?|hsla?)\(/g,
        fix: "derive from a token with color-mix(in srgb, var(--civo-...) N%, transparent)",
    },
    {
        name: "arbitrary size in px/rem/vh/etc.",
        pattern: /[a-z-]+-\[[0-9.]+(?:px|rem|em|vh|vw|dvh|svh|lvh|%|fr)[^\]]*\]/g,
        fix: "use a scale utility (w-72, min-h-96) or add a token; for layout constants see --civo-app-header-height",
    },
    {
        name: "screen-height utility",
        pattern: /\b(?:min-h|h|max-h)-screen\b/g,
        fix: "use dvh (min-h-dvh) or h-app-body; plain vh overflows behind mobile browser toolbars",
    },
];

function sourceFiles(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .map((f) => f.split("\\").join("/"))
        .filter((f) => /\.(ts|tsx|css)$/.test(f));
}

describe("design token conformance (whole source tree)", () => {
    const files = sourceFiles(SRC).filter((f) => !ALLOWED_PATHS.some((a) => a.match(f)));

    it("scans a meaningful number of files (guards against an empty glob passing vacuously)", () => {
        expect(files.length).toBeGreaterThan(100);
    });

    for (const rule of RULES) {
        it(`no ${rule.name}`, () => {
            const violations: string[] = [];
            for (const file of files) {
                const lines = readFileSync(join(SRC, file), "utf8").split("\n");
                lines.forEach((line, i) => {
                    for (const m of line.matchAll(rule.pattern)) violations.push(`${file}:${i + 1}  ${m[0]}`);
                });
            }
            expect(violations, `${rule.name}: ${rule.fix}\n`).toEqual([]);
        });
    }
});

describe("the rules themselves (so the guard cannot silently rot)", () => {
    const flagged = (name: string, text: string) => {
        const rule = RULES.find((r) => r.name === name)!;
        return [...text.matchAll(new RegExp(rule.pattern.source, "g"))].map((m) => m[0]);
    };

    it("flags direct brand text colors but not their foreground/copy tokens", () => {
        const name = "brand color used directly as text or icon color";
        expect(flagged(name, 'className="text-primary hover:text-accent group-hover:text-secondary/80"')).toEqual([
            "text-primary",
            "text-accent",
            "text-secondary/80",
        ]);
        expect(flagged(name, 'className="text-primary-foreground text-accent-copy bg-primary text-copy-muted"')).toEqual([]);
    });

    it("flags palette and literal colors but not token colors", () => {
        expect(flagged("Tailwind default palette color", "text-red-700 bg-amber-50 border-blue-200")).toHaveLength(3);
        expect(flagged("Tailwind default palette color", "text-danger bg-warning-subtle border-info-border")).toEqual([]);
        expect(flagged("literal white/black", "text-white bg-black")).toHaveLength(2);
        expect(flagged("literal white/black", "text-copy bg-surface white-space")).toEqual([]);
    });

    it("flags arbitrary sizes but allows ratios and scale utilities", () => {
        const name = "arbitrary size in px/rem/vh/etc.";
        expect(flagged(name, "min-h-[50vh] grid-cols-[240px_1fr] w-[3rem]")).toHaveLength(3);
        expect(flagged(name, "aspect-[16/7] z-[9999] min-h-96 w-72")).toEqual([]);
    });

    it("flags raw color functions and hex, but not fragment links", () => {
        expect(flagged("raw hex color literal", 'fill="#1F3A34" x="#00e5ff80"')).toHaveLength(2);
        expect(flagged("raw hex color literal", 'href="#main-content" href="#faq"')).toEqual([]);
        expect(flagged("raw rgb()/hsl() color", "rgba(0, 0, 0, 0.18) hsl(10 20% 30%)")).toHaveLength(2);
        expect(flagged("raw rgb()/hsl() color", "color-mix(in srgb, var(--civo-color-text) 18%, transparent)")).toEqual([]);
    });

    it("flags --civo arbitrary values but not var() inside JS props", () => {
        const name = "arbitrary value pointing at a --civo token";
        expect(flagged(name, "bg-[var(--civo-color-primary)] rounded-[var(--civo-radius)]")).toHaveLength(2);
        expect(flagged(name, 'fill: "var(--civo-color-primary)"')).toEqual([]);
    });
});
