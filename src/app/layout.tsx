import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});


/**
 * Root layout.
 *
 * Deliberately does NOT use next/font/google. The design system's
 * typefaces (Source Serif 4, Inter) are declared as CSS custom
 * properties in globals.css with system-font fallbacks, so the app
 * renders correctly even in offline/restricted-network environments and
 * a real self-hosted font strategy can be dropped in later (next/font/
 * local or a <link> to a self-hosted font file) without touching layout
 * structure.
 */
export const metadata: Metadata = {
    title: "Civo — Municipal & Smart City Website Builder",
    description: "Website builder platform for German municipalities, smart-city portals, and civic organizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="de"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}