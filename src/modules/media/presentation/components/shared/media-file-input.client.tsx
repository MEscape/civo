'use client';

// @ui-plain input The file input is hidden and opened by the Upload button: the browser's file chooser has no design-system counterpart.

import type { RefObject } from 'react';

import { MEDIA_FORMATS } from '../../../application/contracts/media-constraints';

interface MediaFileInputProps {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly label: string;
  readonly isMultiple?: boolean;
  readonly onFiles: (files: readonly File[]) => void;
}

const ACCEPT = MEDIA_FORMATS.join(',');

/** The browser's file chooser, kept out of sight: a visible button elsewhere opens it. */
export function MediaFileInput({
  inputRef,
  label,
  isMultiple = false,
  onFiles,
}: MediaFileInputProps) {
  return (
    <input
      ref={inputRef}
      type="file"
      multiple={isMultiple}
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-label={label}
      onChange={(event) => {
        onFiles(Array.from(event.target.files ?? []));
      }}
    />
  );
}
