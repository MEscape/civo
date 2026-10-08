import { useDispatch, useSelector, useStore } from 'react-redux';

import type { BuilderDispatch, BuilderRootState, BuilderStore } from './builder-store';

export const useBuilderDispatch = useDispatch.withTypes<BuilderDispatch>();
export const useBuilderSelector = useSelector.withTypes<BuilderRootState>();
export const useBuilderStore = useStore.withTypes<BuilderStore>();
