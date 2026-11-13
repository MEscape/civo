import { cn } from '@lib/utils';

interface MediaThumbnailProps {
  /** Where anyone can load the image from; `null` for a private file, which has no address. */
  readonly src: string | null;
  /** Names the image where it is the only content; decorative when empty. */
  readonly alt?: string;
  readonly className?: string;
}

/**
 * A small preview that keeps the 4:3 frame whether or not there is an image, so rows and grids
 * do not jump. A private file has no public address and shows the empty frame.
 */
export function MediaThumbnail({ src, alt = '', className }: MediaThumbnailProps) {
  return (
    <div
      className={cn(
        'flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden rounded-token-sm border border-border bg-canvas',
        className,
      )}
    >
      {src !== null && (
        // eslint-disable-next-line @next/next/no-img-element -- a thumbnail served straight from the media origin
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      )}
    </div>
  );
}
