import React, { useEffect, useMemo, useState, useRef } from "react";
import { csv } from "d3-fetch";
import { buildTree } from "../tree_utils";
import type { TreeNode } from "../tree_utils";
import { VizTree } from "@/components/viz_tree_components/viz_tree/viz_tree";
import { Footer } from "@/components/footer";
import { Loader2, Sparkles } from "lucide-react";
import { withBase } from "@/lib/base-url";

const TEMPLATE_TABLE_FONT_SIZE = "var(--font-sm)";
const TEMPLATE_PREVIEW_LENGTH = 80;

export const VisualizeTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [showTemplateSelectControl, setShowTemplateSelectControl] = useState(false);
  const [selectedTemplateSource, setSelectedTemplateSource] = useState("");
  const [isTemplatesLoaded, setIsTemplatesLoaded] = useState(false);
  const [isHierarchyExtracted, setIsHierarchyExtracted] = useState(false);
  const [isExtractingHierarchy, setIsExtractingHierarchy] = useState(false);
  const [expandedTemplateRows, setExpandedTemplateRows] = useState<number[]>([]);
  const extractTimerRef = useRef<number | null>(null);

  useEffect(() => {
    csv(withBase("Krone_Tree.csv")).then(rows => setTreeData(buildTree(rows)));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      if (extractTimerRef.current !== null) {
        window.clearTimeout(extractTimerRef.current);
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

  const canExtractHierarchy = isTemplatesLoaded && !isExtractingHierarchy;

  const showTreeView = isHierarchyExtracted;

  return (
    <>
      <div style={{ minHeight: "100vh", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ paddingTop: "4.5rem" }}></div>
        <div
          style={{
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            paddingBottom: 0,
            marginBottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              marginBottom: 12,
              width: "100%",
              padding: "0 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                padding: "30px 0 35px 0",
                borderBottom: "1px solid #edf1f5",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateSelectControl(true)}
                  style={{
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: isTemplatesLoaded ? "1px solid #bae6fd" : showTemplateSelectControl ? "1px solid #fdba74" : "1px solid #d6d6d6",
                    background: isTemplatesLoaded ? "#f0f9ff" : showTemplateSelectControl ? "#fff7ed" : "#fff",
                    color: isTemplatesLoaded ? "#0369a1" : showTemplateSelectControl ? "#9a3412" : "#475569",
                    fontSize: "var(--font-sm)",
                    fontWeight: 400,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {isTemplatesLoaded ? "✓" : ""}
                  1 Select log templates
                </button>
                <span style={{ color: "#c7cdd4", fontSize: 13 }}>→</span>
                <button
                  type="button"
                  disabled={!canExtractHierarchy}
                  onClick={() => {
                    if (!canExtractHierarchy) return;
                    if (extractTimerRef.current !== null) {
                      window.clearTimeout(extractTimerRef.current);
                      extractTimerRef.current = null;
                    }
                    setIsHierarchyExtracted(false);
                    setIsExtractingHierarchy(true);
                    extractTimerRef.current = window.setTimeout(() => {
                      setIsExtractingHierarchy(false);
                      setIsHierarchyExtracted(true);
                      extractTimerRef.current = null;
                    }, 2500);
                  }}
                  style={{
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 999,
                    border: isHierarchyExtracted ? "1px solid #bae6fd" : isExtractingHierarchy ? "1px solid #fdba74" : "1px solid #d6d6d6",
                    background: isHierarchyExtracted ? "#f0f9ff" : isExtractingHierarchy ? "#fff7ed" : "#fff",
                    color: isHierarchyExtracted ? "#0369a1" : isExtractingHierarchy ? "#9a3412" : "#475569",
                    fontSize: "var(--font-sm)",
                    fontWeight: 400,
                    opacity: canExtractHierarchy || isHierarchyExtracted ? 1 : 0.55,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    cursor: canExtractHierarchy ? "pointer" : "not-allowed",
                  }}
                >
                  {isHierarchyExtracted ? "✓" : ""}
                  <Sparkles size={12} />
                  2 Hierarchy extraction (HDFS dataset)
                </button>
              </div>
            </div>
            {showTemplateSelectControl && (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  padding: "10px 0 0 0",
                }}
              >
                <span style={{ color: "var(--text-label)", fontSize: "var(--font-sm)" }}>Select log templates:</span>
                <select
                  value={selectedTemplateSource}
                  onChange={(e) => setSelectedTemplateSource(e.target.value)}
                  style={{
                    minWidth: 180,
                    height: 30,
                    border: "1px solid #ccc",
                    color: "var(--text-value)",
                    fontSize: "var(--font-sm)",
                    textAlign: "left",
                  }}
                >
                  <option value=""></option>
                  <option value="hdfs">HDFS log templates</option>
                </select>
                <button
                  type="button"
                  disabled={!selectedTemplateSource}
                  onClick={() => {
                    if (!selectedTemplateSource) return;
                    setIsTemplatesLoaded(true);
                    setIsHierarchyExtracted(false);
                    setExpandedTemplateRows([]);
                  }}
                  style={{
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid #d6d6d6",
                    background: "#fff",
                    color: "#334155",
                    fontSize: "var(--font-sm)",
                    fontWeight: 400,
                    cursor: selectedTemplateSource ? "pointer" : "not-allowed",
                    opacity: selectedTemplateSource ? 1 : 0.55,
                  }}
                >
                  Load
                </button>
                {isTemplatesLoaded && (
                  <>
                    <span
                      style={{
                        color: "#0369a1",
                        fontSize: "var(--font-sm)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Loaded {templateRows.length} templates
                    </span>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "var(--font-sm)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Entity: {treeStats.entityCount}
                    </span>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "var(--font-sm)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Action: {treeStats.actionCount}
                    </span>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "var(--font-sm)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Status: {treeStats.statusCount}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: "1 1 auto", position: "relative", overflow: "hidden", minHeight: 0 }}>
        {showTreeView ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              padding: "20px",
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
        ) : isTemplatesLoaded ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              height: "100%",
              minHeight: 0,
              padding: "20px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div className="text-center" style={{ paddingTop: "0.5rem", paddingBottom: "2rem", flex: "0 0 auto" }}>
              <h1 className="font-WPIfont text-black text-2xl font-bold">Templates</h1>
            </div>
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "auto",
                border: "1px solid #edf1f5",
                borderRadius: 12,
                background: "#fff",
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
                          {isLongTemplate && (
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedTemplateRows((prev) =>
                                  prev.includes(index) ? prev.filter((rowIndex) => rowIndex !== index) : [...prev, index]
                                );
                              }}
                              style={{
                                flex: "0 0 auto",
                                border: "1px solid #bae6fd",
                                background: "#f0f9ff",
                                color: "#0369a1",
                                borderRadius: 999,
                                padding: "2px 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                lineHeight: 1.4,
                                cursor: "pointer",
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
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#64748b",
              fontSize: "var(--font-md)",
            }}
          >
            Select log templates and click Load to view templates.
          </div>
        )}
        {isExtractingHierarchy && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "#1f3f8f",
              fontSize: "var(--font-md)",
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(1px)",
            }}
          >
            <Loader2 size={18} className="animate-spin" />
            LLM is thinking...
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
