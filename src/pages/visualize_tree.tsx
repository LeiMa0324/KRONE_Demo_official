import React, { useEffect, useState, useMemo, useRef } from "react";
import { csv } from "d3-fetch";
import { hierarchy } from "d3-hierarchy";
import type { HierarchyNode } from "d3-hierarchy";
import { buildTree } from "../tree_utils";
import { 
  findStatusNode,
  findNodeId, 
} from "../components/viz_tree_components/viz_tree_utils";
import type { TreeNode } from "../tree_utils";
import { TreeControls } from "@/components/viz_tree_components/control_panel/viz_tree_controls";
import { VizTree } from "@/components/viz_tree_components/viz_tree/viz_tree";
import { TreeInfoPanel } from "@/components/viz_tree_components/info_panel/tree_info_panel";
import { Footer } from "@/components/footer";
import { Loader2, Sparkles } from "lucide-react";

export const VisualizeTree: React.FC = () => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [collapseEntities, setCollapseEntities] = useState(false);
  const [collapseActions, setCollapseActions] = useState(false);
  const [collapseStatuses, setCollapseStatuses] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [matchedNodeId, setMatchedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);
  const [matchedNodeObj, setMatchedNodeObj] = useState<HierarchyNode<TreeNode> | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<"logKey" | "sequence" | null>(null);
  const [isHierarchyExtracted, setIsHierarchyExtracted] = useState(false);
  const [isExtractingHierarchy, setIsExtractingHierarchy] = useState(false);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [uploadedTemplateName, setUploadedTemplateName] = useState<string | null>(null);
  const extractTimerRef = useRef<number | null>(null);

  useEffect(() => {
    csv("/Krone_Tree.csv").then(rows => setTreeData(buildTree(rows)));
  }, []);

  useEffect(() => {
    if (searchMode !== "logKey") return;
    if (!treeData || !searchValue) {
      setMatchedNodeId(null);
      return;
    }
    setMatchedNodeId(findStatusNode(treeData, searchValue));
  }, [searchValue, treeData, searchMode]);

  useEffect(() => {
    if (!treeData || !matchedNodeId) {
      setMatchedNodeObj(null);
      return;
    }
    const root = hierarchy(treeData, d => d.children || d._children);
    let found: HierarchyNode<TreeNode> | null = null;
    root.each(node => {
      if (
        (node.depth === 3 && node.data.event_id === matchedNodeId) ||
        ((node.depth === 1 || node.depth === 2) && node.data.name === matchedNodeId)
      ) {
        found = node;
      }
    });
    setMatchedNodeObj(found);
  }, [treeData, matchedNodeId]);

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSelectedEntity(null);
    setSelectedAction(null);
    setSelectedStatus(null);
    setSearchValue(searchInput.trim());
    setSearchMode("logKey");
    if (!searchInput.trim()) setHoveredNode(null);
  }

  function handleClearSearch() {
    setSearchInput("");
    setSearchValue("");
    setMatchedNodeId(null);
    setMatchedNodeObj(null);
    setSelectedEntity(null);
    setSelectedAction(null);
    setSelectedStatus(null);
    setSearchMode(null);
  }

  function handlePathSearch(entity: string, action: string, status: string) {
    setSearchMode("sequence");
    setSearchInput("");
    setSearchValue("");
    if (!treeData) return;

    let foundId: string | null = null;
    if (entity && !action && !status) foundId = entity;
    else if (entity && action && !status) foundId = action;
    else if (entity && !action && status) foundId = findNodeId(treeData, entity, undefined, status);
    else if (entity && action && status) foundId = findNodeId(treeData, entity, action, status);
    else if (!entity && action && !status) foundId = action;
    else if (!entity && !action && status) foundId = findNodeId(treeData, undefined, undefined, status);
    else if (!entity && action && status) foundId = findNodeId(treeData, undefined, action, status);

    setSearchValue(foundId ?? "");
    setMatchedNodeId(foundId);
    if (!foundId) setMatchedNodeObj(null);
  }

  const staticRootNode = useMemo(() => {
    if (!treeData) return null;
    return {
      data: treeData,
      depth: 0,
      parent: null,
      children: (treeData.children || []).map(child => ({ data: child })),
    } as unknown as HierarchyNode<TreeNode>;
  }, [treeData]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      if (extractTimerRef.current !== null) {
        window.clearTimeout(extractTimerRef.current);
      }
    };
  }, []);

  function handleLogKeySearch(logKey: string) {
    setSearchInput(logKey);
    setSearchValue(logKey);
    setSearchMode("logKey");
  }

  const handleTemplateUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files?.[0] ?? null;
    setUploadedTemplateName(nextFile ? nextFile.name : null);
  };

  const statusSteps = ["1 Upload templates", "2 Hierachy extraction"];

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
                {statusSteps.map((step, idx) => {
                  const isActive =
                    (idx === 0 && !isExtractingHierarchy && !isHierarchyExtracted) ||
                    (idx === 1 && isExtractingHierarchy);
                  const isDone =
                    (idx === 0 && (isExtractingHierarchy || isHierarchyExtracted)) ||
                    (idx === 1 && isHierarchyExtracted);
                  return (
                    <React.Fragment key={step}>
                      <button
                        type="button"
                        onClick={() => {
                          if (idx === 0) {
                            if (extractTimerRef.current !== null) {
                              window.clearTimeout(extractTimerRef.current);
                              extractTimerRef.current = null;
                            }
                            setIsExtractingHierarchy(false);
                            setIsHierarchyExtracted(false);
                            setShowTemplateUpload(true);
                          }
                          if (idx === 1) {
                            if (extractTimerRef.current !== null) {
                              window.clearTimeout(extractTimerRef.current);
                              extractTimerRef.current = null;
                            }
                            setIsHierarchyExtracted(false);
                            setIsExtractingHierarchy(true);
                            setShowTemplateUpload(false);
                            extractTimerRef.current = window.setTimeout(() => {
                              setIsExtractingHierarchy(false);
                              setIsHierarchyExtracted(true);
                              extractTimerRef.current = null;
                            }, 2500);
                          }
                        }}
                        style={{
                          height: 30,
                          padding: "0 12px",
                          borderRadius: 999,
                          border: isDone ? "1px solid #86efac" : isActive ? "1px solid #fdba74" : "1px solid #d6d6d6",
                          background: isDone ? "#f0fdf4" : isActive ? "#fff7ed" : "#fff",
                          color: isDone ? "#166534" : isActive ? "#9a3412" : "#475569",
                          fontSize: "var(--font-sm)",
                          fontWeight: 400,
                          opacity: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        {isDone ? "✓" : ""}
                        {idx === 1 && <Sparkles size={12} />}
                        {step}
                      </button>
                      {idx < statusSteps.length - 1 && (
                        <span style={{ color: "#c7cdd4", fontSize: 13 }}>→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {isExtractingHierarchy ? (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "#1f3f8f",
              fontSize: "var(--font-md)",
            }}
          >
            <Loader2 size={18} className="animate-spin" />
            LLM is thinking...
          </div>
        ) : isHierarchyExtracted ? (
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "flex-start", padding: "20px", boxSizing: "border-box", overflow: "hidden", columnGap: 16 }}>
          <div style={{ flex: "0 0 23%", width: "23%", minWidth: 180, maxWidth: "27%", height: "100%", overflowY: "auto", paddingBottom: 200 }}>
            <div style={{ marginBottom: 16 }}>
              <TreeInfoPanel
                node={staticRootNode}
                title="Tree statistics"
                panelTitleFontSize="var(--font-lg)"
                panelTitleFontWeight={700}
                hideNodeName={true}
                sortLogKeys={true}
                showLogKeyGroups={false}
                onLogKeySearch={handleLogKeySearch}
              />
            </div>
            <TreeControls
              collapse={{
                entities: collapseEntities,
                actions: collapseActions,
                statuses: collapseStatuses,
                setEntities: setCollapseEntities,
                setActions: setCollapseActions,
                setStatuses: setCollapseStatuses,
              }}
              search={{
                input: searchInput,
                setInput: setSearchInput,
                value: searchValue,
                matchedNodeId,
                handleSubmit: handleSearchSubmit,
                handleClear: handleClearSearch,
              }}
              selection={{
                entity: selectedEntity,
                setEntity: setSelectedEntity,
                action: selectedAction,
                setAction: setSelectedAction,
                status: selectedStatus,
                setStatus: setSelectedStatus,
                onPathSearch: handlePathSearch,
              }}
              treeData={treeData}
            />
          </div>
          <div style={{ flex: "0 0 45%", width: "45%", minWidth: 0, height: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div className="text-center " style={{ paddingTop: "0.5rem", paddingBottom: "2rem" }} >
              <h1 className="font-WPIfont text-black text-2xl font-bold">Hierarchy Tree</h1>
            </div>
            {treeData && (
              <VizTree
                treeData={treeData}
                collapseEntities={collapseEntities}
                collapseActions={collapseActions}
                collapseStatuses={collapseStatuses}
                matchedNodeId={matchedNodeId}
                setHoveredNode={setHoveredNode}
                showAnomalySymbols={false}
                disableHoverHighlight={!!matchedNodeId}
                showStickyLevelHeaders={true}
                compactVerticalSpacing={true}
                extraColumnSpacing={[0, 10, 14, 14]}
              />
            )}
          </div>
          <div style={{ flex: "0 0 28%", width: "28%", minWidth: 200, maxWidth: "32%", height: "100%", overflowY: "auto" }}>
            <TreeInfoPanel
              node={searchValue && matchedNodeObj ? matchedNodeObj : hoveredNode}
              tableLayout={true}
              showLogKeyGroups={false}
              onLogKeySearch={handleLogKeySearch}
            />
          </div>
          </div>
        ) : (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              color: "#6b7280",
              fontSize: "var(--font-md)",
            }}
          >
            Please upload the log templates
            {showTemplateUpload && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 16,
                  minWidth: 360,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#374151",
                    fontSize: "var(--font-sm)",
                    fontWeight: 400,
                  }}
                >
                  Choose file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleTemplateUploadChange}
                    style={{ display: "none" }}
                  />
                </label>
                <div style={{ marginTop: 10, color: "#6b7280", fontSize: "var(--font-sm)" }}>
                  {uploadedTemplateName ? `Selected: ${uploadedTemplateName}` : "No file selected"}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ flex: "0 0 auto" }}>
          <Footer />
        </div>
      </div>
    </>
  );
};
