import type { BuilderRootState, BuilderThunkExtra } from './builder-store';
import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';

export type BuilderThunk<TResult = void> = ThunkAction<
  TResult,
  BuilderRootState,
  BuilderThunkExtra,
  UnknownAction
>;
