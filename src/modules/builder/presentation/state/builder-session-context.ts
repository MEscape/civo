import { createContext, useContext } from 'react';

import { invariant } from '@lib/utils';

import type { ComponentCatalog } from '../../application/contracts/editor-model';
import type { CategoryOptionsDto } from '../dto/category-options-dto';
import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';

export interface BuilderSession {
  readonly catalog: ComponentCatalog;
  readonly datasetOptions: DatasetOptionsByKind;
  readonly categoryOptions: CategoryOptionsDto;
  /** Drops unsaved edits: the session starts again from the last saved revision. */
  readonly discard: () => void;
}

export const BuilderSessionContext = createContext<BuilderSession | null>(null);

export function useBuilderSession(): BuilderSession {
  const session = useContext(BuilderSessionContext);
  invariant(session !== null, 'useBuilderSession must be used inside BuilderSessionProvider.');
  return session;
}
