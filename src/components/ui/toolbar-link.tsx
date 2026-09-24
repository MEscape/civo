import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Link for workspace bars (builder toolbar, settings header). Shows its
 * label from `xl` up; below that the label stays in the accessibility tree
 * and as a tooltip, which is what lets a bar fit on one row at 1024px.
 * Server-compatible: no client hooks.
 */
export function ToolbarLink({
    href,
    label,
    icon,
    newTab,
    className,
}: {
    href: string;
    label: string;
    icon: React.ReactNode;
    /** Opens in a new tab; announces that, since a silent tab switch disorients screen-reader users. */
    newTab?: boolean;
    className?: string;
}) {
    return (
        <Link
            href={href}
            title={label}
            target={newTab ? "_blank" : undefined}
            className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-token-sm px-2 text-sm text-copy-muted hover:bg-canvas hover:text-copy pointer-coarse:h-11",
                className,
            )}
        >
            {icon}
            <span className="sr-only xl:not-sr-only">{label}</span>
            {newTab && <span className="sr-only">(öffnet in neuem Tab)</span>}
        </Link>
    );
}
