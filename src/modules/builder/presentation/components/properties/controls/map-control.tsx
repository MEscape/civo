import { MapPicker } from '@modules/map/client';

import { useBuilderSelector } from '../../../state/builder-hooks';
import { selectWebsiteId } from '../../../state/builder-selectors';

import type { ControlProps } from './control-props';

export function MapControl({ id, value, onChange, onCommit }: ControlProps) {
  const websiteId = useBuilderSelector(selectWebsiteId);
  return (
    <MapPicker
      id={id}
      websiteId={websiteId}
      value={typeof value === 'string' ? value : undefined}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}
