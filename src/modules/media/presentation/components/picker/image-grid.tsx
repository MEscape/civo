import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { MediaThumbnail } from '../shared/media-thumbnail';

import type { MediaAssetDto } from '../../dto/media-dto';

interface ImageGridProps {
  readonly assets: readonly MediaAssetDto[];
  readonly isLoading: boolean;
  readonly value: string | undefined;
  readonly onChoose: (assetId: string) => void;
}

/** The website's images as a grid of buttons; the chosen one is pressed. */
export function ImageGrid({ assets, isLoading, value, onChoose }: ImageGridProps) {
  const t = useTranslations('media');
  if (assets.length === 0 && !isLoading) {
    return <p className="text-xs text-copy-muted">{t('picker.empty')}</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label={t('picker.gridLabel')} aria-busy={isLoading}>
      {assets.map((asset) => (
        <li key={asset.id}>
          <Button
            type="button"
            variant="ghost"
            aria-pressed={asset.id === value}
            aria-label={asset.originalFilename}
            // The accent ring marks the choice; while focused, the button's focus ring takes over.
            className="block h-auto w-full rounded-token p-0 aria-pressed:ring-2 aria-pressed:not-focus-visible:ring-accent"
            onClick={() => {
              onChoose(asset.id);
            }}
          >
            <MediaThumbnail src={asset.publicUrl} className="w-full" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
