import { select } from "d3-selection";
import type { HierarchyNode } from "d3-hierarchy";
import { decorateNode } from "./node_styling";
import { highlightRelated, resetHighlight } from "../viz_tree_utils";
import {
  getFontSize,
  getPadding,
  NODE_STYLE_STROKE,
  isNodeHidden,
} from "../../../tree_utils";
import { type TreeNode } from "../../../tree_utils";
import type { TreeLink } from "../types";


interface DrawVizTreeParams {
  svgRef: React.RefObject<SVGSVGElement | null>;
  root: HierarchyNode<TreeNode>;
  widestByDepth: number[];
  font: string;
  adjustedWidth: number;
  height: number;
  BASE_FONT: number;
  collapseEntities: boolean;
  templateIdColumnX: number;
  maxTemplateIdWidth: number;
  templateColumnX: number;
  maxTemplateWidth: number;
  matchedNodeId?: string | null;
  showAnomalySymbols: boolean;
  collapsible: boolean;
  clickableNodes: boolean;
  showBadges: boolean;
  expandedTemplatePaths: string[];
  templatePreviewLength: number;
  disableHoverHighlight: boolean;
  showLevelLabels: boolean;
  persistentHighlightNode?: HierarchyNode<TreeNode> | null;
  onToggleTemplateExpand?: (node: HierarchyNode<TreeNode>) => void;
  onNodeClick?: (node: HierarchyNode<TreeNode>) => void;
}

export function drawVizTree({
  svgRef,
  root,
  widestByDepth,
  font,
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
  templatePreviewLength,
  disableHoverHighlight,
  showLevelLabels,
  persistentHighlightNode,
  onToggleTemplateExpand,
  onNodeClick,
}: DrawVizTreeParams) {
  const levelLabels = ["Entity", "Action", "Status"];
  const linkColor = NODE_STYLE_STROKE;
  const labelFontSize = 15;
  const labelToTreeGap = 8;
  const svgRightPadding = 120;

  let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  root.each(d => {
    if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
    if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
    if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
  });

  let width = y1 + 200;
  if (collapseEntities) width = y1 + widestByDepth[1] + 20;
  const minRootWidth = 400;
  const svgWidth = root.descendants().length === 1 ? minRootWidth : width;

  if (!svgRef || !svgRef.current) {
    return;
  }

  // Measure each node text width so node boxes can be sized dynamically.
  const nodeWidthMap = new WeakMap<HierarchyNode<TreeNode>, number>();
  const tempSvg = select(document.body).append("svg")
    .attr("style", "position:absolute; visibility:hidden;")
    .attr("font-family", font);
  root.descendants().forEach((node) => {
    const fontSize = getFontSize(node.depth);
    const tempText = tempSvg.append("text")
      .attr("font-size", fontSize)
      .text(String(node.data.name ?? ""));
    const bbox = tempText.node()?.getBBox();
    const width = Math.max((bbox?.width ?? 0) + getPadding(fontSize) * 2, 52);
    nodeWidthMap.set(node, width);
    tempText.remove();

  });
  tempSvg.remove();

  const svg = select(svgRef.current as SVGSVGElement);
  svg.selectAll("*").remove();
  const verticalOffset = showLevelLabels ? (labelFontSize + labelToTreeGap) : 0;
  const extraBottomPadding = 40;
  const expandedSvgWidth = Math.max(
    svgWidth,
    templateIdColumnX + maxTemplateIdWidth,
    templateColumnX + maxTemplateWidth + svgRightPadding
  );

  svg
    .attr("width", expandedSvgWidth + 35)
    .attr("height", height + verticalOffset + extraBottomPadding)
    .attr("viewBox", `0 ${x0 - verticalOffset} ${expandedSvgWidth} ${height + verticalOffset + extraBottomPadding}`)
    .attr("style", "max-width: none; height: auto; font: 10px;")
    .attr("font-family", font);

  if (showLevelLabels) {
    svg.append("g")
      .attr("class", "level-labels")
      .selectAll("text")
      .data(levelLabels)
      .join("text")
      .attr("x", (_d, i) => {
        const nodesAtDepth = root.descendants().filter(d => d.depth === i + 1 && !isNodeHidden(d));
        if (nodesAtDepth.length === 0) return 0;
        return Math.min(...nodesAtDepth.map(d => d.y ?? 0));
      })
      .attr("y", x0 - BASE_FONT + labelFontSize)
      .attr("text-anchor", "start")
      .attr("font-size", labelFontSize)
      .attr("font-weight", "bold")
      .attr("fill", "#000")
      .attr("opacity", (_d, i) => {
        const nodesAtDepth = root.descendants().filter(d => d.depth === i + 1 && !isNodeHidden(d));
        return nodesAtDepth.length === 0 ? 0 : 1;
      })
      .text(d => d);
  }
 

  // Draw links
  svg.append("g").attr("fill", "none").attr("stroke-width", 1.5)
    .selectAll<SVGPathElement, TreeLink>("path")
    .data(root.links())
    .join("path")
    .attr("d", (d: TreeLink) => {
      const sourceWidth = nodeWidthMap.get(d.source) ?? widestByDepth[d.source.depth];
      const sourceY = (d.source.y ?? 0) + sourceWidth - 20;
      const sourceX = (d.source.x ?? 0) + labelFontSize + labelToTreeGap;
      const targetY = d.target.y ?? 0;
      const targetX = (d.target.x ?? 0) + labelFontSize + labelToTreeGap;
      const midY = (sourceY + targetY) / 2;
      return [
        `M${sourceY},${sourceX}`,
        `H${midY}`,
        `V${targetX}`,
        `H${targetY}`
      ].join(" ");
    })
    .attr("stroke", linkColor)
    .attr("opacity", d => (isNodeHidden(d.source) || isNodeHidden(d.target)) ? 0 : 1);

  // Draw nodes
  const node = svg.append("g")
    .attr("stroke-linejoin", "round")
    .attr("stroke-width", 2)
    .selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", (d: HierarchyNode<TreeNode>) => `translate(${d.y},${(d.x ?? 0) + labelFontSize + labelToTreeGap})`)
    .attr("opacity", d => isNodeHidden(d) ? 0 : 1)
    .attr("pointer-events", d => isNodeHidden(d) ? "none" : "auto")
    .on("mouseover", function (_event: MouseEvent, d: HierarchyNode<TreeNode>) {
      if (!(this instanceof SVGElement) || disableHoverHighlight) return;
      highlightRelated(svg, d);
    })
    .on("mouseout", function () {
      if (!(this instanceof SVGElement) || disableHoverHighlight) return;
      if (persistentHighlightNode) {
        highlightRelated(svg, persistentHighlightNode);
      } else {
        resetHighlight(svg);
      }
    })

  // Draw node labels and decorations
  node.append("text")
    .attr("class", "node-label")
    .attr("dy", "0.31em")
    .attr("x", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth) * 0.2)
    .attr("text-anchor", "start")
    .text((d: HierarchyNode<TreeNode>) => d.data.name)
    .attr("fill", "#000")
    .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
    .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
      decorateNode.call(
        this,
        d,
        widestByDepth,
        {
          clickableNodes,
          collapsible,
          showAnomalySymbols,
          getNodeRectWidth: (node) => nodeWidthMap.get(node) ?? widestByDepth[node.depth],
        }
      );

      if (d.depth < 1 || d.depth > 3) return;

      const bbox = this.getBBox();
      const nodeGroup = select(this.parentNode as SVGGElement);
      const fontSize = getFontSize(d.depth);
      if (showBadges) {
        const stats = d.data.sequenceStats || { normal: 0, abnormal: 0 };
        const normalCount = Number(stats.normal) || 0;
        const abnormalCount = Number(stats.abnormal) || 0;
        const total = normalCount + abnormalCount;
        const badgeFontSize = Math.max(9, Math.floor(fontSize * 0.72));
        const badgeHeight = Math.max(11, Math.floor(badgeFontSize * 1.35));
        const badgeGapY = 3;
        const badgeX = bbox.x + bbox.width + getPadding(fontSize) + 10;
        const centerY = bbox.y + bbox.height / 2;

        const drawBadge = (text: string, y: number, style: { fill: string; stroke: string; color: string }) => {
          const badgeWidth = Math.max(22, Math.ceil(text.length * badgeFontSize * 0.58) + 8);
          nodeGroup.append("rect")
            .attr("x", badgeX)
            .attr("y", y)
            .attr("width", badgeWidth)
            .attr("height", badgeHeight)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("fill", style.fill)
            .attr("stroke", style.stroke)
            .attr("stroke-width", 1);
          nodeGroup.append("text")
            .attr("x", badgeX + badgeWidth / 2)
            .attr("y", y + badgeHeight / 2 + 0.5)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", badgeFontSize)
            .attr("font-weight", 600)
            .attr("fill", style.color)
            .text(text);
        };

        if (total === 0) {
          drawBadge("0", centerY - badgeHeight / 2, {
            fill: "#f8fafc",
            stroke: "#cbd5e1",
            color: "#475569",
          });
        } else {
          const hasNormal = normalCount > 0;
          const hasAbnormal = abnormalCount > 0;
          const topY = hasNormal && hasAbnormal ? centerY - badgeHeight - badgeGapY / 2 : centerY - badgeHeight / 2;
          const bottomY = centerY + badgeGapY / 2;

          if (hasNormal) {
            drawBadge(String(normalCount), topY, {
              fill: "#f0fdf4",
              stroke: "#86efac",
              color: "#166534",
            });
          }

          if (hasAbnormal) {
            drawBadge(String(abnormalCount), bottomY, {
              fill: "#fef2f2",
              stroke: "#fca5a5",
              color: "#b91c1c",
            });
          }
        }
      }

      if (d.depth === 3) {
        nodeGroup.append("text")
          .attr("class", "node-template-id")
          .attr("x", templateIdColumnX - (d.y ?? 0))
          .attr("y", bbox.y + bbox.height / 2)
          .attr("text-anchor", "start")
          .attr("alignment-baseline", "middle")
          .attr("font-size", Math.max(fontSize * 0.9, 12))
          .attr("fill", "#475569")
          .style("white-space", "nowrap")
          .text(d.data.event_id || "-");

        if (d.data.log_template) {
          const pathKey = (d.data.indexPath || []).join(".");
          const isExpanded = expandedTemplatePaths.includes(pathKey);
          const isLongTemplate = d.data.log_template.length > templatePreviewLength;
          const displayedTemplate = !isLongTemplate || isExpanded
            ? d.data.log_template
            : `${d.data.log_template.slice(0, templatePreviewLength)}...`;

          const templateText = nodeGroup.append("text")
            .attr("class", "node-template")
            .attr("x", templateColumnX - (d.y ?? 0))
            .attr("y", bbox.y + bbox.height / 2)
            .attr("text-anchor", "start")
            .attr("alignment-baseline", "middle")
            .attr("font-size", Math.max(fontSize * 0.9, 12))
            .attr("fill", "#475569")
            .style("white-space", "nowrap")
            .text(displayedTemplate);

          if (isLongTemplate) {
            const templateBBox = templateText.node()?.getBBox();
            const buttonLabel = isExpanded ? "Collapse" : "Expand";
            const buttonHeight = 18;
            const buttonWidth = buttonLabel === "Collapse" ? 56 : 46;
            const buttonX = (templateBBox?.x ?? (templateColumnX - (d.y ?? 0))) + (templateBBox?.width ?? 0) + 10;
            const buttonY = bbox.y + bbox.height / 2 - buttonHeight / 2;
            const buttonGroup = nodeGroup.append("g")
              .attr("class", "node-template-toggle")
              .attr("transform", `translate(${buttonX},${buttonY})`)
              .style("cursor", "pointer")
              .on("click", function (event: MouseEvent) {
                event.stopPropagation();
                onToggleTemplateExpand?.(d);
              });

            buttonGroup.append("rect")
              .attr("width", buttonWidth)
              .attr("height", buttonHeight)
              .attr("rx", 9)
              .attr("ry", 9)
              .attr("fill", "#f0f9ff")
              .attr("stroke", "#bae6fd");

            buttonGroup.append("text")
              .attr("x", buttonWidth / 2)
              .attr("y", buttonHeight / 2)
              .attr("text-anchor", "middle")
              .attr("alignment-baseline", "middle")
              .attr("font-size", 12)
              .attr("font-weight", 600)
              .attr("fill", "#0369a1")
              .text(buttonLabel);
          }
        }
      }
    });

  if (onNodeClick) {
    node.on("click", function (_event, d) {
      highlightRelated(svg, d);
      onNodeClick(d);
    });
  }


  // Highlight matched node
  if (matchedNodeId) {
    const matched = root.descendants().find(
      d =>
        d.data.name === matchedNodeId ||
        (d.data.event_id && d.data.event_id === matchedNodeId)
    );
    if (matched) {
      highlightRelated(svg, matched); // highlight matched node
    }
  }

  if (persistentHighlightNode) {
    highlightRelated(svg, persistentHighlightNode);
  }
}
