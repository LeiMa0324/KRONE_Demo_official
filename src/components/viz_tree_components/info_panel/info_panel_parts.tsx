import { getLogKeySubsequence } from "../viz_tree_utils";
import type { TreeNode } from "../../../tree_utils";

import {
  logTemplateStyle,
  logLabelStyle,
  logKeyStyle,
  buttonStyle,
} from "./info_panel_styles";
import type { HierarchyNode } from "d3-hierarchy";



interface NodeTitleProps {
  node: HierarchyNode<TreeNode>;
  title?: string;
  hideNodeName?: boolean;
  isSequencePanel?: boolean;
}

export function NodeTitle({ node, title, hideNodeName, isSequencePanel }: NodeTitleProps) {
  if (title) return <>{title}</>;
  if (hideNodeName) return null;

  switch (node.depth) {
    case 1:
      return <>Entity: <b>{node.data.name}</b></>;
    case 2:
      return <>Action: <b>{node.data.name}</b></>;
    case 3:
      return (
        <>
          Status: <b>{node.data.name}</b>
          {isSequencePanel && <h2 className="font-bold">Node Information</h2>}
          {node.data.log_template && (
            <div style={logTemplateStyle}>
              <span style={logLabelStyle}>Log template:</span>
              <span style={{ marginLeft: 6 }}>{node.data.log_template}</span>
            </div>
          )}
          {node.data.event_id && (
            <div style={logTemplateStyle}>
              <span style={logLabelStyle}>Log key:</span>
              <span style={{ marginLeft: 6 }}>{node.data.event_id}</span>
            </div>
          )}
        </>
      );
    case 0:
      return <>{node.data.name}</>;
    default:
      return null;
  }
}

interface NodeStatsProps {
  node: HierarchyNode<TreeNode>;
  numEntities: number;
  numActions: number;
  numStatuses: number;
}

export function NodeStats({ node, numEntities, numActions, numStatuses }: NodeStatsProps) {
  switch (node.depth) {
    case 0:
      return (
        <>
          <div>Entities: <b>{numEntities}</b></div>
          <div>Actions: <b>{numActions}</b></div>
          <div>Statuses: <b>{numStatuses}</b></div>
        </>
      );
    case 1:
      return (
        <>
          <div>Actions: <b>{numActions}</b></div>
          <div>Statuses: <b>{numStatuses}</b></div>
        </>
      );
    case 2:
      return (
        <div>Statuses: <b>{numStatuses}</b></div>
      );
    default:
      return null;
  }
}

interface LogKeysProps {
  normalLogKeys: string[];
  abnormalLogKeys: string[];
  onLogKeySearch?: (key: string) => void;
}

export function LogKeys({ normalLogKeys, abnormalLogKeys, onLogKeySearch }: LogKeysProps) {
  const renderLogKeys = (keys: string[], color: string) =>
    keys.length > 0 ? (
      keys.map((key, idx) => (
        <span
          key={key}
          style={{
            marginRight: 6,
            cursor: "pointer",
            color,
            textDecoration: "underline",
          }}
          onClick={() => onLogKeySearch?.(key)}
          title="Search this log key"
        >
          {key}
          {idx < keys.length - 1 ? "," : ""}
        </span>
      ))
    ) : (
      <span style={{ color: "#aaa" }}>None</span>
    );

  return (
    <div style={logKeyStyle}>
      <div>
        <span style={{ color: "#4caf50", fontWeight: 400 }}>{`Normal Log Keys (${normalLogKeys.length} Total): `}</span>
        <span
          style={{
            marginLeft: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {renderLogKeys(normalLogKeys, "#4caf50")}
        </span>
      </div>
      <br></br>
      <div>
        <span style={{ color: "#f44336", fontWeight: 400 }}>{`Abnormal Log Keys (${abnormalLogKeys.length} Total): `}</span>
        <span
          style={{
            marginLeft: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          {renderLogKeys(abnormalLogKeys, "#f44336")}
        </span>
      </div>
    </div>
  );
}

interface SequencePanelProps {
  node: HierarchyNode<TreeNode>;
  multiLineAnomaly?: boolean;
  showSummary?: boolean;
}

export function SequencePanel({ node, multiLineAnomaly, showSummary = true }: SequencePanelProps) {
  return (
    <>
      {showSummary && node.data.isAnomaly && (
        <>
          <div>
            <span style={{ color: "#f44336", fontWeight: 400 }}>Anomaly Type:</span>
            <span style={{ marginLeft: 6 }}>{multiLineAnomaly ? "Pattern" : "Template"}</span>
          </div>
          <div>
            <span style={{ color: "#f44336", fontWeight: 400 }}>Anomaly Reason:</span>
            <span style={{ marginLeft: 6 }}>{node.data.anomalyReason}</span>
          </div>
        </>
      )}
      {showSummary && (
        <>
          <h2 className="font-bold">Sequence Info</h2>
          <div>
            <span style={{ fontWeight: 400 }}>Log Sequence:</span>
            <p>[{getLogKeySubsequence(node).join(", ")}]</p>
          </div>
        </>
      )}
      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          style={{ ...buttonStyle, marginTop: 0 }}
          onClick={() => {
            const logKeys = getLogKeySubsequence(node);
            if (logKeys.length === 0) return;
            // Add includeNormal and includeAnomalous as query params
            window.location.href =
              `/knowledge-base?logkeys=[${encodeURIComponent(logKeys.join(","))}]&tab=train`;
          }}>
          Search in Knowledge Base
        </button>
      </div>
    </>
  );
}
