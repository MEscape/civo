import { trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../../application/contracts/component-platform-constraints';

/** Resolve editable text once before loading the interactive directory. */
export function serviceFinderTexts(
  props: ComponentProps<'serviceFinder'>,
  defaults: { readonly heading: string; readonly placeholder: string },
) {
  return {
    heading: trimToNull(props.heading) ?? defaults.heading,
    description: trimToNull(props.description),
    placeholder: trimToNull(props.placeholder) ?? defaults.placeholder,
    initialCategory: trimToNull(props.initialCategory) ?? '',
  };
}
