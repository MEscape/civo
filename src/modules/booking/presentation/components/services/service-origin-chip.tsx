import { Check, Copy, Link2 } from '@components/icons/icons';

import { StatusChip } from '../shared/status-chip';

import type { ServiceOriginDto } from '../../dto/service-dto';

export interface ServiceOriginChipProps {
  readonly kind: ServiceOriginDto['kind'];
  /** How the service came to be here, already translated: "Kopie von Bürgerbüro Süd". */
  readonly children: string;
}

const ICON_BY_KIND = { own: Check, copy: Copy, linked: Link2 } as const;

/** Where a service came from as an icon and the words, so it reads the same in the list, the overview and the review. */
export function ServiceOriginChip({ kind, children }: ServiceOriginChipProps) {
  return (
    <StatusChip tone={kind === 'own' ? 'muted' : 'info'} icon={ICON_BY_KIND[kind]}>
      {children}
    </StatusChip>
  );
}
