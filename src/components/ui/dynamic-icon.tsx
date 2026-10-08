import { hasOwnKey } from '@lib/utils';

import { Icons } from './icons';

import type { IconName, IconProps } from '../../types/icons';

export interface DynamicIconProps extends IconProps {
  /** Icon name from content (`arrow-right` or `arrowRight`); untrusted, so unknown names fall back. */
  readonly name: string | undefined;
  readonly fallback: IconName;
}

function toIconKey(name: string): string {
  return name.trim().replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Renders an icon chosen by data rather than by code, e.g. a municipality's
 * service list. Only icons of this design system can be named, so content
 * never injects markup.
 */
export function DynamicIcon({ name, fallback, ...props }: DynamicIconProps) {
  const key = name === undefined ? fallback : toIconKey(name);
  const Icon = hasOwnKey(Icons, key) ? Icons[key] : Icons[fallback];
  return <Icon {...props} />;
}
