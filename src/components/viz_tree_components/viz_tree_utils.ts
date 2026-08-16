import { select, type Selection } from "d3-selection";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../../tree_utils";
import type { HierarchyNodeWithHiddenChildren, TreeLink } from "./types";
import { linkStroke, nodeFill, nodeInk, nodeStroke } from "../../tree_utils";


export function hasHiddenChildren(node: HierarchyNode<TreeNode>): node is HierarchyNodeWithHiddenChildren<TreeNode> {
  return Array.isArray((node as HierarchyNodeWithHiddenChildren<TreeNode>)._children);
}

export function childrenOrCollapsed(d: TreeNode): TreeNode[] | undefined {
  return d.collapsed ? undefined : d.children;
}

export function offsetSubtree(node: HierarchyNode<TreeNode>, delta: number): void {
  node.x! += delta;
  if (node.children) node.children.forEach(child => offsetSubtree(child, delta));
}

export function getAncestors(node: HierarchyNode<TreeNode>): Set<HierarchyNode<TreeNode>> {
  const ancestors = new Set<HierarchyNode<TreeNode>>();
  let current: HierarchyNode<TreeNode> | null = node;
  while (current) {
    ancestors.add(current);
    current = current.parent;
  }
  return ancestors;
}

/**
 * Dim everything that is not on the hovered node's ancestor path.
 *
 * Both this and resetHighlight restore node styling from the node's own depth
 * rather than a single flat colour, so the Entity/Action/Status tinting
 * survives a hover-and-leave cycle.
 */
export function highlightRelated(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  node: HierarchyNode<TreeNode>
): void {
  const ancestors = getAncestors(node);
  const relatedTemplateRows = new Set(
    node.descendants().filter((descendant) => descendant.depth === 3)
  );

  svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
    .each(function (n) {
      const isRelated = ancestors.has(n);
      select<SVGTextElement, HierarchyNode<TreeNode>>(this)
        .attr("fill", isRelated ? "var(--highlight-text)" : nodeInk(n.depth))
        .attr("opacity", isRelated ? 1 : 0.55);
      select(this.parentNode as SVGElement).select("rect")
        .attr("fill", isRelated ? "var(--highlight-fill)" : nodeFill(n.depth))
        .attr("stroke", isRelated ? "var(--highlight-border)" : nodeStroke(n.depth))
        .attr("stroke-width", isRelated ? 2.5 : 1)
        .attr("opacity", isRelated ? 1 : 0.55);
    });

  svg.selectAll<SVGPathElement, TreeLink>("path")
    .attr("stroke", lnk => {
      const isAncestorPath = ancestors.has(lnk.source) && ancestors.has(lnk.target);
      return isAncestorPath ? "var(--highlight-border)" : linkStroke(lnk.source.depth);
    })
    .attr("stroke-width", lnk => {
      const isAncestorPath = ancestors.has(lnk.source) && ancestors.has(lnk.target);
      return isAncestorPath ? 2.5 : 1.2;
    });

  svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-template-id, text.node-template")
    .each(function (n) {
      const isRelated = relatedTemplateRows.has(n);
      select<SVGTextElement, HierarchyNode<TreeNode>>(this)
        .attr("fill", isRelated ? "var(--highlight-text)" : "var(--table-cell-muted-text)")
        .attr("font-weight", isRelated ? 700 : 400)
        .attr("opacity", isRelated ? 1 : 0.55);
    });
}

export function resetHighlight(
  svg: Selection<SVGSVGElement, unknown, null, undefined>
): void {
  svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
    .attr("fill", n => nodeInk(n.depth))
    .attr("opacity", 1);
  svg.selectAll<SVGGElement, HierarchyNode<TreeNode>>("g")
    .select<SVGRectElement>("rect")
    .attr("fill", function () {
      const datum = select<SVGElement, HierarchyNode<TreeNode>>(this.parentNode as SVGElement).datum();
      return nodeFill(datum?.depth ?? 0);
    })
    .attr("stroke", function () {
      const datum = select<SVGElement, HierarchyNode<TreeNode>>(this.parentNode as SVGElement).datum();
      return nodeStroke(datum?.depth ?? 0);
    })
    .attr("stroke-width", 1)
    .attr("opacity", 1);
  svg.selectAll<SVGPathElement, TreeLink>("path")
    .attr("stroke", lnk => linkStroke(lnk.source.depth))
    .attr("stroke-width", 1.2);
  svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-template-id, text.node-template")
    .attr("fill", "var(--table-cell-muted-text)")
    .attr("font-weight", 400)
    .attr("opacity", 1);
}


export function getAllLogKeys(tree: TreeNode | null): { event_id: string; log_template: string; status: string }[] {
  const result: { event_id: string; log_template: string; status: string }[] = [];
  function traverse(node: TreeNode | undefined): void {
    if (!node) return;
    if (node.event_id && node.log_template) {
      result.push({ event_id: node.event_id, log_template: node.log_template, status: node.name });
    }
    if (node.children) node.children.forEach(traverse);
  }
  traverse(tree ?? undefined);
  return result;
}



export function findStatusNode(node: TreeNode, value: string): string | null {
  if (node.event_id === value) return node.event_id;
  for (const child of node.children || node._children || []) {
    const found = findStatusNode(child, value);
    if (found) return found;
  }
  return null;
}

export function findNodeId(treeData: TreeNode, entity?: string, action?: string, status?: string): string | null {
  for (const entityNode of treeData.children || []) {
    if (entity && entityNode.name !== entity) continue;
    for (const actionNode of entityNode.children || []) {
      if (action && actionNode.name !== action) continue;
      for (const statusNode of actionNode.children || []) {
        if (status && statusNode.name !== status) continue;
        if (statusNode.event_id) return statusNode.event_id;
      }
      if (!status && actionNode.event_id) return actionNode.event_id;
    }
    if (!action && entityNode.event_id) return entityNode.event_id;
  }
  return null;
}

export function collectStats(node: HierarchyNode<TreeNode> | null) {
  let numEntities = 0, numActions = 0, numStatuses = 0;
  const normalLogKeys: string[] = [];
  const abnormalLogKeys: string[] = [];

  function traverse(n: TreeNode, depth: number) {
    if (!n) return;
    if (depth === 0) {
      numEntities = n.children?.length ?? 0;
      n.children?.forEach((entity: TreeNode) => traverse(entity, 1));
    } else if (depth === 1) {
      numActions += n.children?.length ?? 0;
      n.children?.forEach((action: TreeNode) => traverse(action, 2));
    } else if (depth === 2) {
      numStatuses += n.children?.length ?? 0;
      n.children?.forEach((status: TreeNode) => traverse(status, 3));
    } else if (depth === 3) {
      if (n.event_id) {
        (n.isAnomaly ? abnormalLogKeys : normalLogKeys).push(n.event_id);
      }
    }
  }

  if (node) traverse(node.data, node.depth);

  return { numEntities, numActions, numStatuses, normalLogKeys, abnormalLogKeys };
}

export function getLogKeySubsequence(node: HierarchyNode<TreeNode>): string[] {
  if (!node) return [];
  if (node.depth === 3 && node.data.event_id) return [node.data.event_id];
  const keys: string[] = [];
  function collect(n: HierarchyNode<TreeNode>) {
    if (n.depth === 3 && n.data.event_id) {
      keys.push(n.data.event_id);
    }
    if (n.children) n.children.forEach(collect);
  }
  collect(node);
  return keys;
}
