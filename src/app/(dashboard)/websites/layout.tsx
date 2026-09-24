import Link from "next/link";
import React from "react";

/**
 * Layout for the internal dashboard route group. This is the "internal
 * builder" surface used by the team (spec §10) — distinct from the
 * public (site) route group, which has no dashboard chrome at all.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-dvh bg-canvas"
            style={{
                fontFamily: "var(--civo-font-body)",
                "--civo-font-body": "var(--font-geist-sans)",
                "--civo-font-heading": "var(--font-geist-sans)",
            } as React.CSSProperties}
        >
            <header className="h-app-header border-b border-border bg-surface">
                <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
                    <Link
                        href="/websites"
                        className="font-heading text-lg text-primary-copy font-bold"
                    >
                        Civo
                    </Link>
                    <nav className="text-sm text-copy-muted">Interner Bereich</nav>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}
