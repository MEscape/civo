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
 * Uses next/font/google to load Geist and Geist Mono as the primary
 * typefaces for the application.
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