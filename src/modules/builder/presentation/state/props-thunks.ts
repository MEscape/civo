import { VISIBILITY_PROP_KEY } from '../../application/contracts/builder-constraints';
import { updateNodeProps } from '../../application/contracts/editor-model';

import { noticeRaised, propsEditFinished, propsUpdated } from './builder-actions';

import type { BuilderThunk } from './builder-thunk';
import type { PageNodeId, PageNodePropsPatch } from '../../application/contracts/editor-model';

/** One keystroke or control change. History coalesces the burst until `propsEditFinished`. */
export function editNodeProps(nodeId: PageNodeId, patch: PageNodePropsPatch): BuilderThunk {
  return (dispatch, getState) => {
    updateNodeProps(getState().document.history.present.children, nodeId, patch).match(
      (tree) => {
        dispatch(propsUpdated(tree));
      },
      (error) => {
        dispatch(noticeRaised(error.code));
      },
    );
  };
}

/** A toggle is one discrete edit, so it closes its own undo step. */
export function setNodeVisibility(nodeId: PageNodeId, isVisible: boolean): BuilderThunk {
  return (dispatch) => {
    dispatch(editNodeProps(nodeId, { [VISIBILITY_PROP_KEY]: isVisible }));
    dispatch(propsEditFinished());
  };
}
