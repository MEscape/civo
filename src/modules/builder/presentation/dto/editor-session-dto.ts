import { toPageDto } from './page-dto';

import type { PageDto } from './page-dto';
import type {
  ComponentDescriptor,
  EditorMode,
} from '../../application/contracts/builder-constraints';
import type { EditorSessionView } from '../../application/contracts/page-views';

export interface EditorSessionDto {
  readonly page: PageDto;
  readonly editorMode: EditorMode;
  readonly components: readonly ComponentDescriptor[];
}

export function toEditorSessionDto(view: EditorSessionView): EditorSessionDto {
  return {
    page: toPageDto(view.page),
    editorMode: view.editorMode,
    components: view.components,
  };
}
