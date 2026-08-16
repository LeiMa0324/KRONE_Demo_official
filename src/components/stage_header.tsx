import type { ReactNode } from "react";

/**
 * The band above the tree on the four pipeline pages.
 *
 * Each page had grown its own: hierarchy mining had two rows, training and
 * detection had a section title, a chip rail, a description, a batch block and
 * a select row that appeared and disappeared, and the knowledge base had a bare
 * paragraph. The tree therefore started at a different height on every page and
 * jumped as you moved between them, and there was no rule saying which row a
 * given control belonged in.
 *
 * Three rows, always in this order, always these heights:
 *
 *   1. CONTEXT      what is loaded -- dataset, sequence, counts. Not actions.
 *                   `contextEnd` holds a view or scope switch, right-aligned.
 *   2. ACTIONS      the buttons. At most one of them is the primary.
 *                   `actionsEnd` holds the progress of whatever is running.
 *   3. EXPLANATION  one or two sentences on what just happened or happens next.
 *
 * The rows keep their height when empty, which is the point: the band is the
 * same height on all four pages, so the tree below it never moves.
 */
export const StageHeader = ({
  context,
  contextEnd,
  actions,
  actionsEnd,
  explanation,
}: {
  context?: ReactNode;
  contextEnd?: ReactNode;
  actions?: ReactNode;
  actionsEnd?: ReactNode;
  explanation?: ReactNode;
}) => (
  <div className="stage-header">
    <div className="stage-header-row">
      <div className="stage-header-context">{context}</div>
      {contextEnd}
    </div>

    <div className="stage-header-row">
      <div className="stage-header-actions">{actions}</div>
      {actionsEnd}
    </div>

    <p className="stage-header-explanation">{explanation}</p>
  </div>
);
