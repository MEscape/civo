import React from "react";

/**
 * Layout for the public (site) route group. Deliberately minimal — no
 * dashboard chrome. Per-page header/footer/theme are applied inside each
 * website's own render path, not here, since different websites will
 * have different Theme records (spec §9, §10).
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
