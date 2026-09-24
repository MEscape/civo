import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { themeToCssVariables } from "@/modules/website/domain/theme";
import React from "react";

/**
 * Applies a website's theme as CSS custom properties on a wrapping div, and
 * makes that div the size-query container for everything inside the page.
 *
 * Page components must use container variants (`@2xl:`, `@5xl:`), never
 * viewport variants (`sm:`, `lg:`): the builder shows the page inside a
 * 390px / 768px frame on a wide screen, and viewport variants would render
 * the desktop layout squeezed into that frame. Same thresholds as before:
 * sm -> @2xl, md -> @3xl, lg -> @5xl, xl -> @7xl.
 *
 * This is the ONLY mechanism by which stored theme data affects
 * rendering — themeToCssVariables maps a small, validated set of fields
 * (colors, fonts, radius, spacing) to CSS variables; there is no code
 * path anywhere that writes raw/arbitrary CSS from stored data.
 */
export function ThemeProvider({
                                  theme,
                                  children,
                              }: {
    theme: WebsiteTheme;
    children: React.ReactNode;
}) {
    const style = themeToCssVariables(theme) as React.CSSProperties;
    return (
        // data-civo-theme: scope marker. globals.css re-derives tokens (the chart palette)
        // on this element so they resolve against THIS site's colors.
        <div data-civo-theme="" style={{ ...style, fontFamily: "var(--civo-font-body)" }} className="@container min-h-dvh bg-canvas">
            {children}
        </div>
    );
}
