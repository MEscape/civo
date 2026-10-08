import type { SVGProps } from 'react';

/**
 * Union of every icon key exported from `components/ui/icons.tsx`.
 *
 * Derive — do not hard-code — this so adding an icon automatically
 * broadens the union without touching this file.
 *
 * Usage:
 * ```ts
 * import type { IconName } from "@/types/icons";
 * interface ButtonProps { icon?: IconName }
 * ```
 */
import type { Icons } from '@components/ui/icons';

/**
 * Props for a raw SVG icon element.
 *
 * Spread onto every `<svg>` element in `components/ui/icons.tsx` so callers
 * can pass `className`, `aria-label`, `aria-hidden`, `width`, `height`, etc.
 * without a separate prop type per icon.
 *
 * Rule §13: `IconProps` is intentionally a thin alias — do not add custom
 * fields here. If a specific icon variant needs extra behavior, define a
 * richer component in `components/ui/icons.tsx` instead.
 */
export type IconProps = SVGProps<SVGSVGElement>;

/**
 * Callable type for any entry in the `Icons` map.
 *
 * Use this when you need to store an icon as a value, e.g.:
 *
 * ```ts
 * const icon: IconComponent = Icons.check;
 * ```
 *
 * Prefer accepting `IconComponent` over `React.FC<IconProps>` in component
 * APIs because React.FC carries implicit children and defaultProps baggage
 * that an SVG icon will never use.
 */
export type IconComponent = (props: IconProps) => React.ReactElement;

export type IconName = keyof typeof Icons;
