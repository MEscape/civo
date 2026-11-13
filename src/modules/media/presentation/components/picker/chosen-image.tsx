import { MediaThumbnail } from '../shared/media-thumbnail';

import type { MediaAssetDto } from '../../dto/media-dto';

interface ChosenImageProps {
  /** The chosen file when it is among the loaded ones; `undefined` while it is not known (yet). */
  readonly chosen: MediaAssetDto | undefined;
  /** Names the choice when the file itself is not known. */
  readonly fallback: string;
}

/** The current choice: its preview and name, or only the fallback when the file has not been read. */
export function ChosenImage({ chosen, fallback }: ChosenImageProps) {
  return (
    <div className="flex items-center gap-2">
      {chosen?.publicUrl ? (
        <MediaThumbnail src={chosen.publicUrl} alt={chosen.originalFilename} className="w-16" />
      ) : null}
      <span className="min-w-0 truncate text-xs text-copy-muted">
        {chosen?.originalFilename ?? fallback}
      </span>
    </div>
  );
}
