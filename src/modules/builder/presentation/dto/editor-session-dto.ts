import { toPageDto } from './page-dto';

import type { PageDto } from './page-dto';
import type { ComponentDescriptor } from '../../application/contracts/builder-constraints';
import type { EditorSessionView } from '../../application/contracts/page-views';

export interface EditorSessionDto {
  readonly page: PageDto;
  readonly canRestructure: boolean;
  readonly components: readonly ComponentDescriptor[];
}

export function toEditorSessionDto(view: EditorSessionView): EditorSessionDto {
  return {
    page: toPageDto(view.page),
    canRestructure: view.canRestructure,
    components: view.components,
  };
}
