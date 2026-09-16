import type { WebsiteTheme } from "@/modules/website/domain/theme";
import { themeToCssVariables } from "@/modules/website/domain/theme";
import React from "react";

/**
 * Applies a website's theme as CSS custom properties on a wrapping div.
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
        <div style={style} className="min-h-screen bg-[var(--civo-color-background)]">
            {children}
        </div>
    );
}
