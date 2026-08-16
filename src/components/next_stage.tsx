import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * The five data pages are a pipeline -- the Krone-tree mined on the first one is
 * what decomposes sequences on the next, whose knowledge base is what detection
 * matches against -- but the navbar lists them as peers, so a visitor who
 * finishes a page has nothing telling them where the story goes next. This is
 * that hand-off, rendered once in App.tsx and shown only on the pipeline pages.
 */
export const PIPELINE_STAGES = [
  { path: "/visualize-tree", label: "Hierarchy Mining" },
  { path: "/training-process", label: "Training Process" },
  { path: "/sequence-tree", label: "Log Anomaly Detection" },
  { path: "/knowledge-base", label: "Knowledge Base" },
  { path: "/cost-analysis", label: "Cost Analysis" },
] as const;

const StageDoneContext = createContext<(done: boolean) => void>(() => {});

/**
 * A page calls this once it has produced the thing the next stage consumes; the
 * hand-off then goes from a quiet nav affordance to the page's one filled
 * control. Pages that never call it keep the quiet version, which is the honest
 * default -- it still points the right way, it just does not claim you are done.
 */
export const useStageComplete = (done: boolean) => {
  const setDone = useContext(StageDoneContext);
  useEffect(() => {
    setDone(done);
    return () => setDone(false);
  }, [done, setDone]);
};

export const PipelineProgress = ({ children }: { children: ReactNode }) => {
  const [isDone, setIsDone] = useState(false);
  const setDone = useCallback((done: boolean) => setIsDone(done), []);
  const value = useMemo(() => setDone, [setDone]);

  return (
    <StageDoneContext.Provider value={value}>
      {children}
      <NextStage isDone={isDone} />
    </StageDoneContext.Provider>
  );
};

const NextStage = ({ isDone }: { isDone: boolean }) => {
  const { pathname } = useLocation();
  const index = PIPELINE_STAGES.findIndex((stage) => stage.path === pathname);
  const next = index >= 0 ? PIPELINE_STAGES[index + 1] : undefined;

  // Absent until the page has produced what the next stage consumes. A pill
  // sitting there greyed out for the whole visit was one more thing to read
  // and dismiss; arriving is the signal.
  if (!next || !isDone) return null;

  return (
    <Link
      to={next.path}
      className="next-stage-pill animate-fade-in-med"
      data-state="next"
      style={{
        position: "fixed",
        right: 20,
        bottom: "calc(var(--footer-h) + 16px)",
        zIndex: 30,
      }}
    >
      <span className="next-stage-count">
        Step {index + 2} of {PIPELINE_STAGES.length}
      </span>
      <b style={{ fontWeight: 600 }}>{next.label}</b>
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
};
