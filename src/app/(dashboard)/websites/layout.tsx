import Link from "next/link";

/**
 * Layout for the internal dashboard route group. This is the "internal
 * builder" surface used by the team (spec §10) — distinct from the
 * public (site) route group, which has no dashboard chrome at all.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--civo-color-background)]">
            <header className="border-b border-[var(--civo-color-border)] bg-[var(--civo-color-surface)]">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
                    <Link
                        href="/websites"
                        className="font-[family-name:var(--civo-font-heading)] text-lg text-[var(--civo-color-primary)]"
                    >
                        Civo
                    </Link>
                    <nav className="text-sm text-[var(--civo-color-text-muted)]">Interner Bereich</nav>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}
