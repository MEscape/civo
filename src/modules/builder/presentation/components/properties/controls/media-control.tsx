import { MediaPicker } from '@modules/media/client';

import { useBuilderSelector } from '../../../state/builder-hooks';
import { selectWebsiteId } from '../../../state/builder-selectors';

import type { ControlProps } from './control-props';

/** An uploaded image of the page's own website. Only the file's id is stored in the page; the picker never sees a URL it must keep. */
export function MediaControl({ id, value, onChange, onCommit }: ControlProps) {
  const websiteId = useBuilderSelector(selectWebsiteId);

  return (
    <MediaPicker
      id={id}
      websiteId={websiteId}
      value={typeof value === 'string' ? value : undefined}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}
