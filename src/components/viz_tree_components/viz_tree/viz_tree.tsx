import React, { useEffect, useRef, useState } from "react";
import { hierarchy, tree as d3Tree } from "d3-hierarchy";
import { select } from "d3-selection";
import type { TreeNode } from "../../../tree_utils";
import {
  addIndexPath,
  setCollapseAtDepth,
  BASE_FONT,
  getCssVar,
  getWidestByDepth,
  getFontSize,
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
const TEMPLATE_ID_COLUMN_GAP = 32;
const TEMPLATE_COLUMN_GAP = 48;
const HEADER_FONT_SIZE = 15;
const TEMPLATE_PREVIEW_LENGTH = 60;
const HEADER_LABELS = {
  status: "Status",
  templateId: "Log key",
  template: "Templates",
} as const;

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
  showBadges = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [localTree, setLocalTree] = useState<TreeNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null);
  const [expandedTemplatePaths, setExpandedTemplatePaths] = useState<string[]>([]);
  const [levelHeaderPos, setLevelHeaderPos] = useState<{
    entityX: number;
    actionX: number;
    statusX: number;
    templateIdX: number;
    templateX: number;
    statusWidth: number;
    templateIdWidth: number;
    templateWidth: number;
  }>({
    entityX: 0,
    actionX: 120,
    statusX: 240,
    templateIdX: 320,
    templateX: 360,
    statusWidth: 80,
    templateIdWidth: 100,
    templateWidth: 140,
  });

  useEffect(() => {
    if (!treeData) return;
    const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode;
    setCollapseAtDepth(cloned, 1, collapseEntities);
    setCollapseAtDepth(cloned, 2, collapseActions);
    setCollapseAtDepth(cloned, 3, collapseStatuses);
    addIndexPath(cloned);
    setLocalTree(cloned);
    setExpandedTemplatePaths([]);
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

    const tempSvg = select(document.body).append("svg")
      .attr("style", "position:absolute; visibility:hidden;")
      .attr("font-family", font);
    const measureTextWidth = (text: string, fontSize: number) => {
      const tempText = tempSvg.append("text")
        .attr("font-size", fontSize)
        .text(text);
      const bbox = tempText.node()?.getBBox();
      tempText.remove();
      return bbox?.width ?? 0;
    };

    const statusTextInset = getFontSize(3) * 0.2;
    const statusHeaderWidth = measureTextWidth(HEADER_LABELS.status, HEADER_FONT_SIZE);
    const templateIdHeaderWidth = measureTextWidth(HEADER_LABELS.templateId, HEADER_FONT_SIZE);
    const templateHeaderWidth = measureTextWidth(HEADER_LABELS.template, HEADER_FONT_SIZE);
    let maxTemplateIdWidth = 0;
    let maxTemplateWidth = 0;
    hierarchy<TreeNode>(localTree, childrenOrCollapsed).descendants().forEach((node) => {
      if (node.depth !== 3) return;

      maxTemplateIdWidth = Math.max(
        maxTemplateIdWidth,
        measureTextWidth(node.data.event_id || "-", Math.max(getFontSize(node.depth) * 0.9, 12))
      );

      if (!node.data.log_template) return;
      maxTemplateWidth = Math.max(
        maxTemplateWidth,
        measureTextWidth(node.data.log_template, Math.max(getFontSize(node.depth) * 0.9, 12))
      );
    });
    tempSvg.remove();

    const statusX = getYByDepth(3) + statusTextInset;
    const statusWidth = Math.max(widestByDepth[3] - statusTextInset, statusHeaderWidth);
    const templateIdWidth = Math.max(maxTemplateIdWidth, templateIdHeaderWidth);
    const templateWidth = Math.max(maxTemplateWidth, templateHeaderWidth);
    const templateIdColumnX = statusX + statusWidth + TEMPLATE_ID_COLUMN_GAP;
    const templateColumnX = templateIdColumnX + templateIdWidth + TEMPLATE_COLUMN_GAP;
    setLevelHeaderPos({
      entityX: getYByDepth(1),
      actionX: getYByDepth(2),
      statusX,
      templateIdX: templateIdColumnX,
      templateX: templateColumnX,
      statusWidth,
      templateIdWidth,
      templateWidth,
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
        templateIdColumnX,
        maxTemplateIdWidth,
        templateColumnX,
        maxTemplateWidth,
        matchedNodeId,
        showAnomalySymbols,
        collapsible,
        clickableNodes,
        showBadges,
        expandedTemplatePaths,
        templatePreviewLength: TEMPLATE_PREVIEW_LENGTH,
      disableHoverHighlight,
      showLevelLabels: !showStickyLevelHeaders,
      persistentHighlightNode,
      onToggleTemplateExpand: (node) => {
        const pathKey = (node.data.indexPath || []).join(".");
        if (!pathKey) return;
        setExpandedTemplatePaths((prev) =>
          prev.includes(pathKey) ? prev.filter((item) => item !== pathKey) : [...prev, pathKey]
        );
      },
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
    showBadges,
    expandedTemplatePaths,
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
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            minHeight: 40,
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
              width: levelHeaderPos.statusWidth,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: STATUS_BORDER,
              whiteSpace: "nowrap",
            }}
          >
            Status
          </span>
          <span
            style={{
              position: "absolute",
              left: levelHeaderPos.templateIdX,
              width: levelHeaderPos.templateIdWidth,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: STATUS_BORDER,
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
          >
            Log key
          </span>
          <span
            style={{
              position: "absolute",
              left: levelHeaderPos.templateX,
              width: levelHeaderPos.templateWidth,
              fontSize: "var(--font-sm)",
              fontWeight: 700,
              color: STATUS_BORDER,
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
          >
            Templates
          </span>
        </div>
      )}
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
};
