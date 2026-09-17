import type { Metadata } from "next";
import { localFontVariables } from "@/lib/fonts/local-fonts";
import "./globals.css";
import React from "react";


/**
 * Root layout.
 *
 * Uses next/font/google to load Geist and Geist Mono as the platform's
 * own UI typefaces (builder chrome, dashboards), and next/font/local
 * (via `localFontVariables`) to load the self-hosted font families that
 * per-website themes can select for heading/body text — see
 * `src/modules/website/domain/theme.ts` and
 * `src/lib/fonts/local-fonts.ts`.
 */
export const metadata: Metadata = {
    title: "Civo — Municipal & Smart City Website Builder",
    description: "Website builder platform for German municipalities, smart-city portals, and civic organizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="de"
            className={`${localFontVariables} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
