import localFont from "next/font/local";

/**
 * Self-hosted theme fonts.
 *
 * These are loaded with `next/font/local` rather than `next/font/google`
 * because the platform must not depend on a runtime fetch to
 * fonts.googleapis.com — files are bundled and served from this
 * deployment's own `/public/fonts` directory (self-hosting also avoids a
 * third-party network request in every visitor's browser).
 *
 * IMPORTANT — placeholder files: the .woff2 files currently checked in
 * under `public/fonts/**` are structurally valid but glyph-less
 * placeholders (see `public/fonts/FONTS.md`). Swap in the real font
 * files at the same paths/weights before shipping; nothing else in the
 * app needs to change when you do.
 *
 * Each loader below produces a CSS custom property (`variable`) that
 * `theme.ts` maps a font family *name* onto — see
 * `FONT_VARIABLE_BY_FAMILY`. Adding a new self-hosted family means:
 *   1. drop the weight files under public/fonts/<family-slug>/
 *   2. add a `localFont(...)` call here with a new `--font-*` variable
 *   3. register the family name in `AVAILABLE_HEADING_FONTS` /
 *      `AVAILABLE_BODY_FONTS` and `FONT_VARIABLE_BY_FAMILY` in theme.ts
 */

export const sourceSerif = localFont({
    src: [
        { path: "../../../public/fonts/source-serif/SourceSerif4-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../../public/fonts/source-serif/SourceSerif4-Bold.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-source-serif",
    display: "swap",
});

export const inter = localFont({
    src: [
        { path: "../../../public/fonts/inter/Inter-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../../public/fonts/inter/Inter-Medium.woff2", weight: "500", style: "normal" },
        { path: "../../../public/fonts/inter/Inter-SemiBold.woff2", weight: "600", style: "normal" },
        { path: "../../../public/fonts/inter/Inter-Bold.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-inter",
    display: "swap",
});

export const dmSans = localFont({
    src: [
        { path: "../../../public/fonts/dm-sans/DMSans-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../../public/fonts/dm-sans/DMSans-Medium.woff2", weight: "500", style: "normal" },
        { path: "../../../public/fonts/dm-sans/DMSans-Bold.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-dm-sans",
    display: "swap",
});

export const geistLocal = localFont({
    src: [
        { path: "../../../public/fonts/geist/Geist-Regular.woff2", weight: "400", style: "normal" },
        { path: "../../../public/fonts/geist/Geist-Medium.woff2", weight: "500", style: "normal" },
        { path: "../../../public/fonts/geist/Geist-SemiBold.woff2", weight: "600", style: "normal" },
        { path: "../../../public/fonts/geist/Geist-Bold.woff2", weight: "700", style: "normal" },
    ],
    variable: "--font-geist-sans",
    display: "swap",
});

/**
 * All local font `variable` class names, combined for the root
 * `<html>` element in `app/layout.tsx`. Every self-hosted family must be
 * included here or its CSS variable will never be defined on the page.
 */
export const localFontVariables = [sourceSerif.variable, inter.variable, dmSans.variable, geistLocal.variable].join(" ");
