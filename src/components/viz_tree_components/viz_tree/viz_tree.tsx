import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree } from "d3-hierarchy";
import type { TreeNode } from "../../../tree_utils";
import {
  addIndexPath,
  setCollapseAtDepth,
  BASE_FONT,
  getCssVar,
  getWidestByDepth,
  ENTITY_BORDER,
  ACTION_BORDER,
  STATUS_BORDER,
} from "../../../tree_utils";
import type { 
  VizTreeProps,
} from "../types";
import {
  childrenOrCollapsed,
  offsetSubtree,
} from "../viz_tree_utils";
import { drawVizTree } from "./draw_viz_tree";

const DEFAULT_FONT = "sans-serif";
const FONT_CSS_VAR = "--font-WPIfont";
const EXTRA_COL_SPACING = [0, 60, 60, 60];
const NODE_SIZE_X = 40;
const NODE_SIZE_Y = 0;
const MIN_ENTITY_GAP = 50;
const SVG_PADDING = 200;
const COLLAPSED_WIDTH_PADDING = 20;
const MIN_ROOT_WIDTH = 400;
const DIV_STYLE = { flex: 1, width: "100%", height: "100%", overflow: "auto" };

export const VizTree: React.FC<VizTreeProps> = ({
  treeData,
  collapseEntities,
  collapseActions,
  collapseStatuses,
  matchedNodeId,
  setHoveredNode,
  showAnomalySymbols = true,
  collapsible = false,
  disableHoverHighlight = false,
  onNodeClick,
  clickableNodes = false,
  showStickyLevelHeaders = false,
  compactVerticalSpacing = false,
  extraColumnSpacing,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [localTree, setLocalTree] = useState<TreeNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  const [levelHeaderPos, setLevelHeaderPos] = useState<{ entityX: number; actionX: number; statusX: number }>({
    entityX: 0,
    actionX: 120,
    statusX: 240,
  });

  useEffect(() => {
    if (!treeData) return;
    const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
    setCollapseAtDepth(cloned, 1, collapseEntities);
    setCollapseAtDepth(cloned, 2, collapseActions);
    setCollapseAtDepth(cloned, 3, collapseStatuses);
    addIndexPath(cloned);
    setLocalTree(cloned);
  }, [treeData, collapseEntities, collapseActions, collapseStatuses]);

  useEffect(() => {
    if (!svgRef.current || !localTree) return;

    const font = getCssVar(FONT_CSS_VAR) || DEFAULT_FONT;
    const widestByDepth = getWidestByDepth(localTree, font);

    const extraColSpacing = extraColumnSpacing ?? EXTRA_COL_SPACING;
    const colOffsets = [0];
    for (let i = 1; i < widestByDepth.length; i++) {
      colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
    }
    const getYByDepth = (depth: number) => colOffsets[depth];
    setLevelHeaderPos({
      entityX: getYByDepth(1),
      actionX: getYByDepth(2),
      statusX: getYByDepth(3),
    });

    const root = hierarchy<TreeNode>(localTree, childrenOrCollapsed);
    const nodeSizeX = compactVerticalSpacing ? 28 : NODE_SIZE_X;
    d3Tree<TreeNode>().nodeSize([nodeSizeX, NODE_SIZE_Y]).separation(() => 1)(root);

    // Align parent nodes to the first child so the root stays on the first row.
    const topAlign = (node: typeof root) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => topAlign(child));
        node.x = node.children[0].x;
      }
    };
    topAlign(root);

    // Ensure minimum gap between entity nodes
    const minEntityGap = compactVerticalSpacing ? 34 : MIN_ENTITY_GAP;
    const entityNodes = root.children || [];
    for (let i = 1; i < entityNodes.length; i++) {
      const prev = entityNodes[i - 1];
      const curr = entityNodes[i];
      if (curr.x! - prev.x! < minEntityGap) {
        const offset = minEntityGap - (curr.x! - prev.x!);
        offsetSubtree(curr, offset);
        for (let j = i + 1; j < entityNodes.length; j++) {
          offsetSubtree(entityNodes[j], offset);
        }
      }
    }

    // Keep root always on the first row by shifting the whole tree upward.
    const rootOffsetX = root.x ?? 0;
    if (rootOffsetX !== 0) {
      root.each((node) => {
        node.x = (node.x ?? 0) - rootOffsetX;
      });
    }

    root.each(node => { node.y = getYByDepth(node.depth); });
    const persistentHighlightNode = selectedNodePath
      ? root.descendants().find((node) => (node.data.indexPath || []).join(".") === selectedNodePath) ?? null
      : null;

    // Calculate height and width for SVG
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    root.each(d => {
      if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
      if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
      if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
    });

    let width = y1 + SVG_PADDING;
    if (collapseEntities) width = y1 + widestByDepth[1] + COLLAPSED_WIDTH_PADDING;
    const minRootWidth = MIN_ROOT_WIDTH;
    const adjustedWidth = root.descendants().length === 1 ? minRootWidth : width;
    const height = x1 - x0 + BASE_FONT * 2;

      drawVizTree({
        svgRef,
        root,
        widestByDepth,
      font,
      adjustedWidth,
      height,
        BASE_FONT,
        collapseEntities,
        matchedNodeId,
        showAnomalySymbols,
        collapsible,
        clickableNodes,
      disableHoverHighlight,
      showLevelLabels: !showStickyLevelHeaders,
      persistentHighlightNode,
      onNodeClick: (node) => {
        setSelectedNodePath((node.data.indexPath || []).join("."));
        setHoveredNode?.(node);
        onNodeClick?.(node);
      },
    });
  }, [
    localTree,
    matchedNodeId,
    setHoveredNode,
    showAnomalySymbols,
    collapsible,
    clickableNodes,
    disableHoverHighlight,
    onNodeClick,
    selectedNodePath,
    compactVerticalSpacing,
    extraColumnSpacing,
  ]);

  return (
    <div className="mb-8" style={DIV_STYLE}>
      {showStickyLevelHeaders && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "#fff",
            borderBottom: "1px solid #edf1f5",
            minHeight: 30,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: levelHeaderPos.entityX,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: ENTITY_BORDER,
              whiteSpace: "nowrap",
            }}
          >
            Entity
          </span>
          <span
            style={{
              position: "absolute",
              left: levelHeaderPos.actionX,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: ACTION_BORDER,
              whiteSpace: "nowrap",
            }}
          >
            Action
          </span>
          <span
            style={{
              position: "absolute",
              left: levelHeaderPos.statusX,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: STATUS_BORDER,
              whiteSpace: "nowrap",
            }}
          >
            Status
          </span>
        </div>
      )}
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
};
