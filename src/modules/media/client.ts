/**
 * Browser-safe public API: the picker, its routes and DTO types, nothing that reaches
 * server-only code. Client Components import from here instead of the main `index.ts`.
 */

export { MediaPicker } from './presentation/components/picker/media-picker.client';
export type { MediaPickerProps } from './presentation/components/picker/media-picker.client';
export { mediaRoutes } from './presentation/routes';
export type { MediaAssetDto } from './presentation/dto/media-dto';
