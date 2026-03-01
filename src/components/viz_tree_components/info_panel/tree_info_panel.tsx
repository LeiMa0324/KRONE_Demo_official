import React, { useMemo } from "react";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../../../tree_utils";
import { collectStats } from "../viz_tree_utils";

import {
  NodeTitle,
  NodeStats,
  LogKeys,
  SequencePanel,
} from "./info_panel_parts";
import {
  panelStyle,
  titleStyle,
  infoStyle,
} from "./info_panel_styles";

type TreeInfoPanelProps = {
  node: HierarchyNode<TreeNode> | null;
  title?: string;
  panelTitleFontSize?: string | number;
  panelTitleFontWeight?: number;
  hideNodeName?: boolean;
  sortLogKeys?: boolean;
  showLogKeyGroups?: boolean;
  multiLineAnomaly?: boolean;
  isSequencePanel?: boolean;
  tableLayout?: boolean;
  onLogKeySearch?: (logKey: string) => void;
};


export const TreeInfoPanel: React.FC<TreeInfoPanelProps> = ({
  node,
  title,
  panelTitleFontSize,
  panelTitleFontWeight,
  hideNodeName = false,
  multiLineAnomaly = false,
  showLogKeyGroups = true,
  isSequencePanel = false,
  tableLayout = false,
  onLogKeySearch,
}) => {
  type TableRow = {
    label: string;
    value: string;
    boxed?: boolean;
    highlighted?: boolean;
    color?: string;
  };

  type ExtraSection = {
    title: string;
    rows: TableRow[];
  };

  const tableLabelWidth = 150;
  const tableRowHeight = 44;
  const tableDivider = "#edf1f5";
  const sequencePanelFontSize = "var(--font-sm)";
  const tableFontSize = isSequencePanel ? sequencePanelFontSize : "var(--font-md)";
  const defaultPanelTitleFontSize = isSequencePanel ? sequencePanelFontSize : titleStyle.fontSize;
  const sequenceSectionTitleFontSize = "var(--font-md)";
  const sequenceSectionTitleWeight = 700;
  const tablePanelTitleWeight = 700;
  const emptyStateFontSize = isSequencePanel ? sequencePanelFontSize : "var(--font-lg)";

  const renderRowsTable = (rows: TableRow[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row.label}-${rowIndex}`} style={{ borderBottom: `1px solid ${tableDivider}`, height: tableRowHeight }}>
            <th
              style={{
                textAlign: "left",
                verticalAlign: "middle",
                width: `${tableLabelWidth}px`,
                padding: "10px 6px",
                fontSize: tableFontSize,
                fontWeight: 700,
                color: "var(--text-label)",
                lineHeight: "22px",
              }}
            >
              {row.label}
            </th>
            <td
              style={{
                textAlign: "left",
                verticalAlign: "middle",
                padding: "10px 6px",
                fontSize: tableFontSize,
                color: row.color ?? "var(--text-value)",
                fontWeight: 400,
                wordBreak: "break-word",
                lineHeight: "22px",
              }}
            >
              {row.boxed ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    border: row.highlighted ? "1px solid #60a5fa" : "1px solid #d0d0d0",
                    borderRadius: 6,
                    background: row.highlighted ? "#dbeafe" : "#f7f7f7",
                    color: "var(--text-value)",
                    fontWeight: 400,
                  }}
                >
                  {row.value}
                </span>
              ) : (
                row.value
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTablePanel = (
    panelTitle: string,
    rows: TableRow[],
    footer?: React.ReactNode,
    extraSection?: ExtraSection,
    titleFontSize?: string | number
  ) => {
    const resolvedTitleFontSize = titleFontSize ?? (isSequencePanel ? sequenceSectionTitleFontSize : defaultPanelTitleFontSize);
    return (
      <div style={panelStyle}>
        <div
          style={{
            ...titleStyle,
            fontSize: resolvedTitleFontSize,
            fontWeight: isSequencePanel ? sequenceSectionTitleWeight : tablePanelTitleWeight,
            marginBottom: 8,
            paddingBottom: 10,
            borderBottom: `1px solid ${tableDivider}`,
          }}
        >
          {panelTitle}
        </div>
        {renderRowsTable(rows)}
        {extraSection && (
          <>
            {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
            <div
            style={{
                ...titleStyle,
                fontSize: resolvedTitleFontSize,
                fontWeight: isSequencePanel ? sequenceSectionTitleWeight : tablePanelTitleWeight,
                marginTop: 14,
                marginBottom: 8,
                paddingTop: 10,
                paddingBottom: 10,
                borderTop: `1px solid ${tableDivider}`,
                borderBottom: `1px solid ${tableDivider}`,
              }}
            >
              {extraSection.title}
            </div>
            {renderRowsTable(extraSection.rows)}
          </>
        )}
        {!extraSection && footer && <div style={{ marginTop: 12 }}>{footer}</div>}
      </div>
    );
  };

  // Always call hooks unconditionally
  const { numEntities, numActions, numStatuses, normalLogKeys, abnormalLogKeys } = node
    ? collectStats(node)
    : { numEntities: 0, numActions: 0, numStatuses: 0, normalLogKeys: [], abnormalLogKeys: [] };

  const sortedNormalLogKeys = useMemo(
    () => [...normalLogKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [normalLogKeys]
  );
  const sortedAbnormalLogKeys = useMemo(
    () => [...abnormalLogKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [abnormalLogKeys]
  );

  if (!node) {
    return (
      <div style={{ ...panelStyle, color: "#888", fontSize: emptyStateFontSize }}>
        Click a node to see details
      </div>
    );
  }

  const getNameAtDepth = (targetDepth: number) => {
    if (node.depth < targetDepth) return "-";
    let current: HierarchyNode<TreeNode> | null = node;
    while (current && current.depth > targetDepth) {
      current = current.parent;
    }
    if (!current || current.depth !== targetDepth) return "-";
    return current.data.name || "-";
  };

  const countDirectActions = (target: HierarchyNode<TreeNode>) =>
    (target.children || []).filter((child) => child.depth === 2).length;

  const countStatusLeaves = (target: HierarchyNode<TreeNode>) =>
    target
      .descendants()
      .filter((desc) => desc.depth === 3 && (!desc.children || desc.children.length === 0)).length;

  if (isSequencePanel) {
    const panelTitle = "Node details";
    let rows: TableRow[] = [];

    if (node.depth === 1) {
      rows = [
        { label: "Entity", value: getNameAtDepth(1), boxed: true, highlighted: true },
      ];
    } else if (node.depth === 2) {
      rows = [
        { label: "Entity", value: getNameAtDepth(1), boxed: true },
        { label: "Action", value: getNameAtDepth(2), boxed: true, highlighted: true },
      ];
    } else {
      const logTemplate = node.depth === 3 ? (node.data.log_template || "-") : "-";
      const hasAnyLogKey = node.depth === 3
        ? !!node.data.event_id
        : (normalLogKeys.length + abnormalLogKeys.length) > 0;
      const isAbnormal = node.depth === 3
        ? !!node.data.isAnomaly
        : abnormalLogKeys.length > 0;
      const predictionLabel = hasAnyLogKey ? (isAbnormal ? "Abnormal" : "Normal") : "-";
      const predictionColor = predictionLabel === "Abnormal"
        ? "#f44336"
        : predictionLabel === "Normal"
          ? "#4caf50"
          : "#888";
      const anomalyReason = node.data.isAnomaly ? (node.data.anomalyReason || "-") : "-";
      rows = [
        { label: "Entity", value: getNameAtDepth(1), boxed: true },
        { label: "Action", value: getNameAtDepth(2), boxed: true },
        { label: "Status", value: getNameAtDepth(3), boxed: true, highlighted: true },
      ];

      const logKeyDetailRows: TableRow[] = [
        { label: "Log Template", value: logTemplate },
        { label: "Log Key Prediction", value: predictionLabel, color: predictionColor },
        // { label: "Anomaly Type", value: anomalyType, color: anomalyType === "-" ? undefined : "#f44336" },
        { label: "Anomaly Reason", value: anomalyReason },
      ];

      return renderTablePanel(
        panelTitle,
        rows,
        <SequencePanel node={node} multiLineAnomaly={multiLineAnomaly} showSummary={false} />,
        { title: "Log Key Details", rows: logKeyDetailRows },
        "var(--font-lg)"
      );
    }

    return renderTablePanel(
      panelTitle,
      rows,
      <SequencePanel node={node} multiLineAnomaly={multiLineAnomaly} showSummary={false} />,
      undefined,
      "var(--font-lg)"
    );
  }

  if (tableLayout) {
    const logKey = node.depth === 3 ? (node.data.event_id || "-") : "-";
    const logTemplate = node.depth === 3 ? (node.data.log_template || "-") : "-";

    const rows: TableRow[] = node.depth === 1
      ? [
        { label: "Entity", value: getNameAtDepth(1), boxed: true, highlighted: true },
        { label: "Num of actions", value: String(countDirectActions(node)) },
        { label: "Num of status", value: String(countStatusLeaves(node)) },
      ]
      : node.depth === 2
        ? [
          { label: "Entity", value: getNameAtDepth(1), boxed: true },
          { label: "Action", value: getNameAtDepth(2), boxed: true, highlighted: true },
          { label: "Num of status", value: String(countStatusLeaves(node)) },
        ]
        : [
          { label: "Entity", value: getNameAtDepth(1), boxed: true },
          { label: "Action", value: getNameAtDepth(2), boxed: true },
          { label: "Status", value: getNameAtDepth(3), boxed: true, highlighted: true },
          { label: "Log Key", value: logKey },
          { label: "Log Template", value: logTemplate },
        ];

    return renderTablePanel("Node Details", rows, undefined, undefined, "var(--font-lg)");
  }

  const showLogKeys = showLogKeyGroups && ((node.depth !== 3 && !isSequencePanel) || (node.depth === 3 && !isSequencePanel));

  return (
    <div style={panelStyle}>
      <div
        style={{
          ...titleStyle,
          ...(panelTitleFontSize ? { fontSize: panelTitleFontSize } : {}),
          ...(panelTitleFontWeight ? { fontWeight: panelTitleFontWeight } : {}),
        }}
      >
        <NodeTitle node={node} title={title} hideNodeName={hideNodeName} isSequencePanel={isSequencePanel} />
      </div>
      <div style={infoStyle}>
        <NodeStats node={node} numEntities={numEntities} numActions={numActions} numStatuses={numStatuses} />
      </div>
      {showLogKeys && (
        <LogKeys
          normalLogKeys={sortedNormalLogKeys}
          abnormalLogKeys={sortedAbnormalLogKeys}
          onLogKeySearch={onLogKeySearch}
        />
      )}
      {isSequencePanel && (
        <SequencePanel node={node} multiLineAnomaly={multiLineAnomaly} />
      )}
    </div>
  );
};
