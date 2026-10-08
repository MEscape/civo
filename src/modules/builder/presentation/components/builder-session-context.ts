import { createContext, useContext } from 'react';

import { invariant } from '@lib/utils';

import type { ComponentCatalog } from '../../application/contracts/editor-model';
import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';

export interface BuilderSession {
  readonly catalog: ComponentCatalog;
  readonly datasetOptions: DatasetOptionsByKind;
}

export const BuilderSessionContext = createContext<BuilderSession | null>(null);

export function useBuilderSession(): BuilderSession {
  const session = useContext(BuilderSessionContext);
  invariant(session !== null, 'useBuilderSession must be used inside BuilderSessionProvider.');
  return session;
}
