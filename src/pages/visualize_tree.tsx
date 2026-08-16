import React, { useEffect, useMemo, useState, useRef } from "react";
import { csv } from "d3-fetch";
import { buildTree } from "../tree_utils";
import type { TreeNode } from "../tree_utils";
import { VizTree } from "@/components/viz_tree_components/viz_tree/viz_tree";
import { Footer } from "@/components/footer";
import { Loader2, Sparkles } from "lucide-react";
import { useDataset } from "@/DatasetContext";
import { DatasetChip } from "@/components/dataset_selector";
import { useStageComplete } from "@/components/next_stage";
import { StageHeader } from "@/components/stage_header";

const TEMPLATE_TABLE_FONT_SIZE = "var(--font-sm)";
const TEMPLATE_PREVIEW_LENGTH = 80;
const EXTRACTION_DURATION_MS = 1100;

/**
 * The page is the first stage of the demo's pipeline, and it is staged in three
 * beats: the dataset (answered on the homepage), the templates it ships, and the
 * hierarchy the LLM mines from them.
 *
 * It lands on "templates" rather than on an empty canvas -- there is something
 * to read the moment you arrive -- but deliberately stops short of the tree, so
 * that the one thing KRONE actually does here is something the visitor sets off
 * themselves. Exactly one control is filled at any moment; that, plus a guidance
 * line that changes with the stage, is the whole guidance mechanism.
 */
type Stage = "templates" | "extracting" | "extracted";

export const VisualizeTree: React.FC = () => {
  const { fileFor } = useDataset();
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [stage, setStage] = useState<Stage>("templates");
  const [expandedTemplateRows, setExpandedTemplateRows] = useState<number[]>([]);
  const [activeView, setActiveView] = useState<"tree" | "templates">("tree");
  const stageTimerRef = useRef<number | null>(null);

  useEffect(() => {
    csv(fileFor("Krone_Tree")).then(rows => setTreeData(buildTree(rows)));
  }, [fileFor]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
      }
    };
  }, []);

  const templateRows = useMemo(() => {
    const rows: Array<{ templateId: string; template: string }> = [];

    const walk = (node: TreeNode | null) => {
      if (!node) return;
      if (node.event_id || node.log_template) {
        rows.push({
          templateId: node.event_id || "-",
          template: node.log_template || "-",
        });
      }
      node.children?.forEach(walk);
    };

    walk(treeData);
    return rows;
  }, [treeData]);

  const treeStats = useMemo(() => {
    let entityCount = 0;
    let actionCount = 0;
    let statusCount = 0;

    if (treeData?.children) {
      entityCount = treeData.children.length;
      treeData.children.forEach((entityNode) => {
        const actions = entityNode.children || [];
        actionCount += actions.length;
        actions.forEach((actionNode) => {
          statusCount += actionNode.children?.length || 0;
        });
      });
    }

    return {
      entityCount,
      actionCount,
      statusCount,
    };
  }, [treeData]);

  const runExtraction = () => {
    if (stage === "extracting") return;
    setActiveView("tree");
    setStage("extracting");
    if (stageTimerRef.current !== null) window.clearTimeout(stageTimerRef.current);
    stageTimerRef.current = window.setTimeout(() => {
      setStage("extracted");
      stageTimerRef.current = null;
    }, EXTRACTION_DURATION_MS);
  };

  const showTreeView = stage === "extracted" && activeView === "tree";

  useStageComplete(stage === "extracted");

  const guidance: string =
    stage === "templates"
      ? "KRONE mines an entity / action / status hierarchy out of these log templates with an LLM."
      : stage === "extracting"
        ? `Grouping ${templateRows.length} templates into entity, action and status levels…`
        : "The Krone-tree is ready. It is what decomposes log sequences on every stage that follows.";

  return (
    <>
      <div style={{ minHeight: "100vh", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ paddingTop: "var(--stage-top)" }}></div>

        {/* The inset the other three pages get from their scroll container's
            padding, so the dataset chip starts at the same x here. */}
        <div style={{ padding: "0 var(--stage-inset)" }}>
        <StageHeader
          context={
            <>
              <DatasetChip />
              <span aria-hidden="true" style={{ color: "var(--n-300)" }}>|</span>
              <span>
                <b style={{ color: "var(--n-900)", fontWeight: 600 }}>{templateRows.length}</b> log templates
              </span>

              {/* The level counts are a result of extraction, so they join the
                  line when it produces them rather than sitting at zero. The
                  swatches went with the tree's colours: three identical grey
                  dots would have been a legend for a distinction the tree no
                  longer draws. */}
              {stage === "extracted" &&
                ([
                  ["entities", treeStats.entityCount],
                  ["actions", treeStats.actionCount],
                  ["statuses", treeStats.statusCount],
                ] as const).map(([label, count]) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                    <span aria-hidden="true" style={{ color: "var(--n-300)" }}>|</span>
                    <b style={{ color: "var(--n-900)", fontWeight: 600 }}>{count}</b>
                    {label}
                  </span>
                ))}
            </>
          }
          actions={
            <>
              {stage === "templates" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runExtraction}
                  title="Mine the entity / action / status hierarchy from these templates"
                >
                  <Sparkles size={13} aria-hidden="true" />
                  Extract hierarchy
                </button>
              )}

              {/* The same button, busy: it keeps its place and its weight
                  rather than being replaced by a full-screen overlay, so the
                  templates it is working on stay on screen. */}
              {stage === "extracting" && (
                <button type="button" className="btn btn-primary" data-busy="true" disabled>
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Mining hierarchy…
                </button>
              )}

              {/* Once the tree is out there is nothing left to run here, so the
                  actions row hands over to the two views of what was produced.
                  The forward path is the hand-off in the corner, which lights
                  up at the same moment. */}
              {stage === "extracted" && (
                <div className="segmented" role="group" aria-label="Switch view">
                  {([["tree", "Krone-tree"], ["templates", `Templates (${templateRows.length})`]] as const).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setActiveView(view)}
                      aria-pressed={activeView === view}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </>
          }
          explanation={<span aria-live="polite">{guidance}</span>}
        />
        </div>
        {/* While a stage is running the canvas recedes instead of being covered:
            the busy button in the header is the status, and the templates being
            worked on stay readable underneath. */}
        <div
          aria-busy={stage === "extracting"}
          style={{
            flex: "1 1 auto",
            position: "relative",
            overflow: "hidden",
            minHeight: 0,
            padding: "0 var(--stage-inset)",
            opacity: stage === "extracting" ? 0.45 : 1,
            transition: "opacity 200ms ease",
          }}
        >
        {showTreeView ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "20px 0",
              boxSizing: "border-box",
              overflow: "hidden",
              columnGap: 16,
              height: "100%",
            }}
          >
            <div style={{ flex: "1 1 auto", minWidth: 0, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
              <div className="text-center " style={{ paddingTop: "0.5rem", paddingBottom: "2rem" }} >
                <h1 className="font-WPIfont text-black text-2xl font-bold">Krone-tree</h1>
              </div>
              {treeData && (
                <VizTree
                  treeData={treeData}
                  collapseEntities={false}
                  collapseActions={false}
                  collapseStatuses={false}
                  matchedNodeId={null}
                  showAnomalySymbols={false}
                  disableHoverHighlight={false}
                  showStickyLevelHeaders={true}
                  compactVerticalSpacing={true}
                  extraColumnSpacing={[0, 10, 14, 14]}
                  showBadges={false}
                />
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              height: "100%",
              minHeight: 0,
              padding: "20px 0",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div className="text-center" style={{ paddingTop: "0.5rem", paddingBottom: "1.25rem", flex: "0 0 auto" }}>
              <h1 className="font-WPIfont text-2xl font-bold text-[var(--n-900)]">Templates</h1>
            </div>
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "auto",
                border: "1px solid var(--table-cell-border)",
                borderRadius: "var(--r-md)",
                background: "var(--n-0)",
                boxShadow: "var(--e1)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px minmax(480px, 1fr)",
                  gap: 0,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--table-header-bg)",
                  borderBottom: "1px solid var(--table-header-border)",
                }}
              >
                <div style={{ padding: "var(--table-cell-py) var(--table-cell-px)", fontSize: TEMPLATE_TABLE_FONT_SIZE, fontWeight: 700, color: "var(--table-header-text)" }}>
                  Log key
                </div>
                <div style={{ padding: "var(--table-cell-py) var(--table-cell-px)", fontSize: TEMPLATE_TABLE_FONT_SIZE, fontWeight: 700, color: "var(--table-header-text)", textAlign: "left" }}>
                  Templates
                </div>
              </div>
              {templateRows.map((row, index) => (
                <div
                  key={`${row.templateId}-${index}`}
                  className="data-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px minmax(480px, 1fr)",
                    gap: 0,
                    borderBottom: "1px solid var(--table-cell-border)",
                  }}
                >
                  <div
                    style={{
                      padding: "var(--table-cell-py) var(--table-cell-px)",
                      fontSize: TEMPLATE_TABLE_FONT_SIZE,
                      color: "var(--table-cell-muted-text)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.templateId}
                  </div>
                  <div
                    style={{
                      padding: "var(--table-cell-py) var(--table-cell-px)",
                      fontSize: TEMPLATE_TABLE_FONT_SIZE,
                      color: "var(--table-cell-text)",
                      minWidth: 0,
                      textAlign: "left",
                    }}
                  >
                    {(() => {
                      const isExpanded = expandedTemplateRows.includes(index);
                      const isLongTemplate = row.template.length > TEMPLATE_PREVIEW_LENGTH;
                      const displayTemplate =
                        !isLongTemplate || isExpanded
                          ? row.template
                          : `${row.template.slice(0, TEMPLATE_PREVIEW_LENGTH)}...`;

                      return (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                          <span style={{ flex: "1 1 auto", minWidth: 0, lineHeight: 1.5 }}>{displayTemplate}</span>
                          {/* A filled blue pill on every long row stacked into a
                              column of visual noise. Quiet by default, coloured
                              on hover. */}
                          {isLongTemplate && (
                            <button
                              type="button"
                              className="row-toggle"
                              aria-expanded={isExpanded}
                              onClick={() => {
                                setExpandedTemplateRows((prev) =>
                                  prev.includes(index) ? prev.filter((rowIndex) => rowIndex !== index) : [...prev, index]
                                );
                              }}
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <Footer />
        </div>
      </div>
    </>
  );
};
