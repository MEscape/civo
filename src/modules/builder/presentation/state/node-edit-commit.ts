import type { AppResult } from '@lib/result';

import { noticeRaised, snapshotCommitted } from './builder-actions';

import type { BuilderThunk } from './builder-thunk';
import type { EditorSnapshot, NodeOperationError } from '../../application/contracts/editor-model';

/** A validation error's first field code is the useful one; everything else reports its own code. */
function noticeCodeOf(error: NodeOperationError): string {
  if (error.kind !== 'validation') {
    return error.code;
  }
  return Object.values(error.fieldErrors).flat()[0] ?? error.code;
}

/** Applies an edit's outcome: commit one undo step, or tell the user why it was refused. */
export function commit(result: AppResult<EditorSnapshot, NodeOperationError>): BuilderThunk {
  return (dispatch) => {
    result.match(
      (snapshot) => {
        dispatch(snapshotCommitted(snapshot));
      },
      (error) => {
        dispatch(noticeRaised(noticeCodeOf(error)));
      },
    );
  };
}
