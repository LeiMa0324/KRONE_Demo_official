import { select } from "d3-selection";
import type { HierarchyNode } from "d3-hierarchy";
import { hasHiddenChildren } from "@/components/viz_tree_components/viz_tree_utils";
import {
  getFontSize,
  getPadding,
  getRadius,
  nodeFill,
  nodeInk,
  nodeStroke,
} from "@/tree_utils";

import type { TreeNode } from "@/tree_utils";

interface TreeNodeData extends TreeNode {
  collapsed?: boolean;
  indexPath?: number[];
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export function decorateNode(
  this: SVGTextElement,
  d: HierarchyNode<TreeNodeData>,
  widestByDepth: number[],
  {
    clickableNodes,
    collapsible,
    showAnomalySymbols,
    getNodeRectWidth,
  }: {
    clickableNodes: boolean;
    collapsible: boolean;
    showAnomalySymbols: boolean;
    getNodeRectWidth?: (node: HierarchyNode<TreeNodeData>) => number;
  }
) {
  const fontSize = getFontSize(d.depth);
  const padding = getPadding(fontSize);
  const radius = getRadius(fontSize);
  const nodeGroup = select(this.parentNode as SVGGElement);
  const bbox = this.getBBox();
  const rectWidth = getNodeRectWidth?.(d) ?? widestByDepth[d.depth];

  // Label background, tinted by depth so Entity / Action / Status are legible
  // as levels while scanning horizontally across a very wide tree.
  nodeGroup.insert("rect", "text")
    .attr("x", bbox.x - padding)
    .attr("y", bbox.y - padding / 2)
    .attr("width", rectWidth)
    .attr("height", bbox.height + padding)
    .attr("fill", nodeFill(d.depth))
    .attr("stroke", nodeStroke(d.depth))
    .attr("rx", radius).attr("ry", radius)
    .style("cursor", clickableNodes ? "pointer" : "default");

  // Match the label to its level, unless a highlight class has claimed it.
  if (!select(this).classed("highlighted-node")) {
    select(this).attr("fill", nodeInk(d.depth));
  }

  // Clickable node highlight
  if (clickableNodes) {
    nodeGroup
      .on("mouseover.button", function () {
        select(this).select("rect")
          .attr("stroke-width", 1.6)
          .attr("filter", "brightness(0.96)");
      })
      .on("mouseout.button", function () {
        select(this).select("rect")
          .attr("stroke-width", null)
          .attr("filter", null);
      })
      .on("mousedown.button", function () {
        select(this).select("rect").attr("filter", "brightness(0.9)");
      })
      .on("mouseup.button", function () {
        select(this).select("rect").attr("filter", "brightness(0.96)");
      });
  }

  // Collapse indicator
  if (collapsible && d.data.collapsed === true && d.data.indexPath && d.depth < 3) {
    nodeGroup.insert("text", "text")
      .attr("class", "collapse-indicator")
      .attr("x", (bbox.x - padding) + rectWidth + padding * 1.5)
      .attr("y", bbox.y + bbox.height / 2 + 2)
      .attr("alignment-baseline", "middle")
      .attr("font-size", Math.max(fontSize * 0.8, 16))
      .attr("fill", "var(--n-500)")
      .attr("text-anchor", "start")
      .style("cursor", "pointer")
      .text("▶");
  }

  // Anomaly warning symbol
  if (
    showAnomalySymbols &&
    d.depth === 3 &&
    !d.children &&
    !hasHiddenChildren(d) &&
    d.data.isAnomaly
  ) {
    nodeGroup.insert("text", "text")
      .attr("class", "anomaly-warning")
      .attr("x", bbox.x - padding * 2.5 - 15)
      .attr("y", bbox.y + bbox.height / 2 + 2)
      .attr("alignment-baseline", "middle")
      .attr("font-size", Math.max(fontSize * 0.8, 14))
      .attr("fill", "var(--sem-anomaly)")
      .attr("text-anchor", "start")
      .style("cursor", "pointer")
      .text("⚠️")
      .append("title")
      .text(function() {
        return d.data.anomalyReason || "Anomaly detected";
      });
  }
}
