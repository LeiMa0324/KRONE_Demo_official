import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import type { KroneDecompRow, KroneDetectRow } from "@/pages/visualize_table";
import { hierarchy, tree } from "d3-hierarchy";
import type { HierarchyNode, HierarchyLink } from "d3-hierarchy";
import { select } from "d3-selection";
import Papa from "papaparse";
import { Loader2, Sparkles } from "lucide-react";
import {
    addIndexPath,
    isNodeHidden,
    arraysEqual,
    getFirstAnomalyReason,
    BASE_FONT,
    DEPTH_SPACING,
    getFontSize,
    getPadding,
    getRadius,
    getCssVar,
    linkBorderColor,
    NODE_STYLE_FILL,
    NODE_STYLE_STROKE,
    getWidestByDepth,
    svgInit, 
    svgLines,
    svgNodes
} from "../tree_utils";

import type { TreeNode } from "../tree_utils";
import { withBase } from "@/lib/base-url";

// Define the props for the SequenceTree component
type SequenceTreeProps = {
    kroneDecompData: KroneDecompRow[];
    totalSequenceCount?: number;
    visibleSequenceCount?: number;
    kroneDetectData: KroneDetectRow[];
    setHoveredNode?: (node: HierarchyNode<TreeNode> | null) => void;
    setMultiLineAnomaly: (isMultiLineAnomaly: boolean) => void;
    multiLineAnomaly: boolean;
    demoMode?: boolean;
    selectStepLabel?: string;
    selectControlLabel?: string;
    decomposeStepLabel?: string;
    topDescriptionText?: string;
    hideDetectAndExplainSteps?: boolean;
    hideSelectStep?: boolean;
    singleSequenceSectionTitle?: string;
    batchProcessingSectionTitle?: string;
    batchProcessingButtonLabel?: string;
    knowledgeBaseActionLabel?: string;
    knowledgeBaseActionButtons?: Array<{ id: string; label: string; toastMessage?: string }>;
    knowledgeBaseActionsInert?: boolean;
};


const DEMO_EVENT_ID_TO_LOG_TEMPLATE: Record<string, string> = {
    "1": "Session started",
    "2": "Session opened successfully",
    "3": "Auth start initiated",
    "4": "Auth succeeded",
};

const DEFAULT_COLUMN_HEADER_POS = {
    entityX: 105,
    actionX: 275,
    statusX: 465,
    indexX: 665,
    indexW: 90,
    logKeyX: 755,
    logKeyW: 110,
    logTemplateX: 875,
    logTemplateW: 320,
    contentWidth: 1200,
};

const normalizeLabelText = (value: string | undefined | null) =>
    String(value ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

type OrderedActionSequence = {
    pathKey: string;
    label: string;
    lineNumbers: number[];
};

type OrderedEntitySequence = {
    pathKey: string;
    label: string;
    actionPathKeys: string[];
    lineNumbers: number[];
};

const collectOrderedActionSequences = (treeData: TreeNode | null): OrderedActionSequence[] => {
    if (!treeData) return [];
    addIndexPath(treeData);
    return (treeData.children ?? []).flatMap((entityNode) =>
        (entityNode.children ?? []).map((actionNode) => ({
            pathKey: (actionNode.indexPath ?? []).join("."),
            label: normalizeLabelText(actionNode.name),
            lineNumbers: (actionNode.children ?? [])
                .map((statusNode) => statusNode.lineNumber)
                .filter((lineNumber): lineNumber is number => typeof lineNumber === "number"),
        }))
    );
};

const collectOrderedEntitySequences = (treeData: TreeNode | null): OrderedEntitySequence[] => {
    if (!treeData) return [];
    addIndexPath(treeData);
    return (treeData.children ?? []).map((entityNode) => ({
        pathKey: (entityNode.indexPath ?? []).join("."),
        label: normalizeLabelText(entityNode.name),
        actionPathKeys: (entityNode.children ?? []).map((actionNode) => (actionNode.indexPath ?? []).join(".")),
        lineNumbers: (entityNode.children ?? []).flatMap((actionNode) =>
            (actionNode.children ?? [])
                .map((statusNode) => statusNode.lineNumber)
                .filter((lineNumber): lineNumber is number => typeof lineNumber === "number")
        ),
    }));
};


// Converts a KroneDecompRow to a TreeNode structure, including anomaly detection and log template mapping.
// This function processes the data to create a hierarchical tree structure suitable for visualization.
function toTreeNode(
    data: KroneDecompRow,
    anomalies: KroneDetectRow[],
    eventIdToLogTemplate: Record<string, string>,
    showDecomposed: boolean,
    showDetected: boolean
): TreeNode {
    const entities: TreeNode[] = [];
    const { entity_nodes_for_logkeys: e, action_nodes_for_logkeys: a, status_nodes_for_logkeys: s, seq } = data;

    // Create a mapping of event IDs to log templates
    for (let i = 0; i < e.length; i++) {
        const actions: TreeNode[] = [];
        const statuses: TreeNode[] = [];
        const entityName = showDecomposed ? normalizeLabelText(e[i]) : "";
        const actionName = showDecomposed ? normalizeLabelText(a[i]) : "";
        const statusName = showDecomposed ? normalizeLabelText(s[i]) : "";
        statuses.push({
            name: statusName,
            lineNumber: i,
            event_id: seq[i], // log key
            log_template: eventIdToLogTemplate?.[seq[i]] || "", // log template if available
            isAnomaly: false,
            anomalyReason: "",
        });
        actions.push({ name: actionName, children: statuses });
        entities.push({ name: entityName, children: actions });
    }

    // Process anomalies and mark entities and actions accordingly
    let hasAnomalies = false;
    let foundAnomaly = null as KroneDetectRow | null;
    anomalies.forEach(anomaly => {
        if (anomaly.seq_id === data.seq_id) {
            hasAnomalies = true;
            foundAnomaly = anomaly;
        }
    });


    // If anomalies are found, mark the corresponding entities, actions, and statuses
    if (showDetected && hasAnomalies && foundAnomaly!) {
        const anomalyLength = foundAnomaly.anomaly_seg.length;
        for (let i = 0; i <= e.length - anomalyLength; i++) {
            if (arraysEqual(seq.slice(i, i + anomalyLength), foundAnomaly.anomaly_seg)) {
                for (let j = i; j < i + anomalyLength; j++) {
                    if (foundAnomaly.anomaly_level === "status") {
                        entities[j].children![0].children![0].isAnomaly = true;
                        entities[j].children![0].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children![0].isRelatedToAnomaly = true;
                        entities[j].isRelatedToAnomaly = true;
                    }
                    if (foundAnomaly.anomaly_level === "action") {
                        entities[j].children![0].isAnomaly = true;
                        entities[j].children![0].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].isRelatedToAnomaly = true;
                        entities[j].children![0].children!.forEach(stat => {
                            stat.isRelatedToAnomaly = true;
                        });
                    }
                    if (foundAnomaly.anomaly_level === "entity") {
                        entities[j].isAnomaly = true;
                        entities[j].anomalyReason = foundAnomaly.anomaly_reason;
                        entities[j].children!.forEach(act => {
                            act.isRelatedToAnomaly = true;
                            act.children!.forEach(stat => {
                                stat.isRelatedToAnomaly = true;
                            });
                        });
                    }
                }
            }
        }
    }

    // Merge duplicate entity/action nodes only in decomposed mode.
    if (showDecomposed) {
        let i = 0;
        while (i < entities.length - 1) {
            if (entities[i].name === entities[i + 1].name) {
                entities[i].children = (entities[i].children ?? []).concat(entities[i + 1].children ?? []);
                entities.splice(i + 1, 1);
            } else {
                i++;
            }
        }

        for (let j = 0; j < entities.length; j++) {
            let k = 0;
            while (k < entities[j].children!.length - 1) {
                if (entities[j].children![k].name === entities[j].children![k + 1].name) {
                    entities[j].children![k].children = (entities[j].children![k].children ?? []).concat(entities[j].children![k + 1].children ?? []);
                    entities[j].children!.splice(k + 1, 1);
                } else {
                    k++;
                }
            }
        }
    }

    // Mark nodes as related to anomalies
    function propagateRelatedToAnomaly(node: TreeNode) {
        if (!node.children) return false;
        let anyChildRelated = false;
        for (const child of node.children) {
            const childRelated = propagateRelatedToAnomaly(child);
            if (child.isRelatedToAnomaly || childRelated) {
                anyChildRelated = true;
            }
        }
        if (anyChildRelated) {
            node.isRelatedToAnomaly = true;
        }
        return node.isRelatedToAnomaly;
    }
    propagateRelatedToAnomaly({ name: "Root", children: entities });

    return { name: "Root", children: entities };
}

// This function calculates the highlight Y coordinates for entity nodes in the tree for multi line anomalies
function getEntityHighlightY(
    root: HierarchyNode<TreeNode>,
    getFontSize: (depth: number) => number,
    getPadding: (fontSize: number) => number
) {
    const anomalyEntityNodes = root.descendants().filter(
        node => node.depth === 1 && !!node.data.isAnomaly && !isNodeHidden(node)
    ).sort((a, b) => a.x! - b.x!);

    if (!anomalyEntityNodes.length) return null;

    const highlightYStart = anomalyEntityNodes[0].x!;
    const lastEntityNode = anomalyEntityNodes[anomalyEntityNodes.length - 1];
    const fontSize = getFontSize(1);
    const highlightYEnd = lastEntityNode.x! + fontSize + getPadding(fontSize);
    return { highlightYStart, highlightYEnd };
}

// This function calculates the highlight Y coordinates for action nodes in the tree for multi line anomalies
function getActionHighlightY(
    root: HierarchyNode<TreeNode>,
    getFontSize: (depth: number) => number,
    getPadding: (fontSize: number) => number
) {
    const anomalyActionNodes = root.descendants().filter(
        node => node.depth === 2 && !!node.data.isAnomaly && !isNodeHidden(node)
    ).sort((a, b) => a.x! - b.x!);

    if (!anomalyActionNodes.length) return null;

    const highlightYStart = anomalyActionNodes[0].x!;
    const lastActionNode = anomalyActionNodes[anomalyActionNodes.length - 1];
    const fontSize = getFontSize(2);
    const highlightYEnd = lastActionNode.x! + fontSize + getPadding(fontSize);
    return { highlightYStart, highlightYEnd };
}

// The SequenceTree component renders a hierarchical tree structure based on the provided Krone decomposition and detection data.

export const SequenceTree: React.FC<SequenceTreeProps> = ({
    kroneDecompData,
    totalSequenceCount,
    visibleSequenceCount,
    kroneDetectData,
    setHoveredNode,
    setMultiLineAnomaly,
    multiLineAnomaly,
    demoMode = false,
    selectStepLabel = "1 Select a test log sequence",
    selectControlLabel = "Select a test sequence:",
    decomposeStepLabel = "2 Decompose",
    topDescriptionText,
    hideDetectAndExplainSteps = false,
    hideSelectStep = false,
    singleSequenceSectionTitle,
    batchProcessingSectionTitle,
    batchProcessingButtonLabel,
    knowledgeBaseActionLabel = "5 Add to Knowledge Base",
    knowledgeBaseActionButtons,
    knowledgeBaseActionsInert = false,
}) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const sequenceSelectRef = useRef<HTMLSelectElement | null>(null);
    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [showSelectControl, setShowSelectControl] = useState(hideSelectStep);
    const [showDecomposed, setShowDecomposed] = useState(false);
    const [showDetected, setShowDetected] = useState(false);
    const [showAnomalyExplanation, setShowAnomalyExplanation] = useState(false);
    const [hasExplainedAnomaly, setHasExplainedAnomaly] = useState(false);
    const [isDecomposing, setIsDecomposing] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const [eventIdToLogTemplate, setEventIdToLogTemplate] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [anomalyLevelMulti, setAnomalyLevelMulti] = useState("Normal");
    const [kbToastMessage, setKbToastMessage] = useState<string | null>(null);
    const [kbToastVisible, setKbToastVisible] = useState(false);
    const [kbDialogMessage, setKbDialogMessage] = useState<string | null>(null);
    const [savedKnowledgeBaseActionIds, setSavedKnowledgeBaseActionIds] = useState<string[]>([]);
    const [activeKnowledgeBaseActionPath, setActiveKnowledgeBaseActionPath] = useState<string | null>(null);
    const [completedKnowledgeBaseActionPaths, setCompletedKnowledgeBaseActionPaths] = useState<string[]>([]);
    const [activeKnowledgeBaseEntityPath, setActiveKnowledgeBaseEntityPath] = useState<string | null>(null);
    const [completedKnowledgeBaseEntityPaths, setCompletedKnowledgeBaseEntityPaths] = useState<string[]>([]);
    const [isActiveKnowledgeBaseRoot, setIsActiveKnowledgeBaseRoot] = useState(false);
    const [isCompletedKnowledgeBaseRoot, setIsCompletedKnowledgeBaseRoot] = useState(false);
    const [isSavingStatusSequence, setIsSavingStatusSequence] = useState(false);
    const [isSavingActionSequence, setIsSavingActionSequence] = useState(false);
    const [isSavingEntitySequence, setIsSavingEntitySequence] = useState(false);
    const [isBatchProcessingAllSequences, setIsBatchProcessingAllSequences] = useState(false);
    const [batchProcessingStepLabel, setBatchProcessingStepLabel] = useState<string | null>(null);
    const [batchProcessingProgress, setBatchProcessingProgress] = useState(0);
    const [explanationModalPos, setExplanationModalPos] = useState({ x: 220, y: 160 });
    const [explanationModalWidth, setExplanationModalWidth] = useState(460);
    const decomposeTimerRef = useRef<number | null>(null);
    const detectTimerRef = useRef<number | null>(null);
    const explainTimerRef = useRef<number | null>(null);
    const explanationDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
    const explanationResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const kbToastHideTimerRef = useRef<number | null>(null);
    const kbToastRemoveTimerRef = useRef<number | null>(null);
    const knowledgeBaseAnimationRunRef = useRef(0);
    const [columnHeaderPos, setColumnHeaderPos] = useState<{
        entityX: number;
        actionX: number;
        statusX: number;
        indexX: number;
        indexW: number;
        logKeyX: number;
        logKeyW: number;
        logTemplateX: number;
        logTemplateW: number;
        contentWidth: number;
    }>(DEFAULT_COLUMN_HEADER_POS);

    const resetExplanationState = () => {
        if (explainTimerRef.current !== null) {
            window.clearTimeout(explainTimerRef.current);
            explainTimerRef.current = null;
        }
        setIsExplaining(false);
        setShowAnomalyExplanation(false);
        setHasExplainedAnomaly(false);
    };

    const resetDetectingState = () => {
        if (detectTimerRef.current !== null) {
            window.clearTimeout(detectTimerRef.current);
            detectTimerRef.current = null;
        }
        setIsDetecting(false);
    };

    const resetDecomposingState = () => {
        if (decomposeTimerRef.current !== null) {
            window.clearTimeout(decomposeTimerRef.current);
            decomposeTimerRef.current = null;
        }
        setIsDecomposing(false);
    };

    const resetKnowledgeBaseSequenceState = useCallback(() => {
        knowledgeBaseAnimationRunRef.current += 1;
        setSavedKnowledgeBaseActionIds([]);
        setActiveKnowledgeBaseActionPath(null);
        setCompletedKnowledgeBaseActionPaths([]);
        setActiveKnowledgeBaseEntityPath(null);
        setCompletedKnowledgeBaseEntityPaths([]);
        setIsActiveKnowledgeBaseRoot(false);
        setIsCompletedKnowledgeBaseRoot(false);
        setIsSavingStatusSequence(false);
        setIsSavingActionSequence(false);
        setIsSavingEntitySequence(false);
        setIsBatchProcessingAllSequences(false);
        setBatchProcessingStepLabel(null);
        setBatchProcessingProgress(0);
        setKbDialogMessage(null);
    }, []);

    useEffect(() => {
        return () => {
            if (decomposeTimerRef.current !== null) {
                window.clearTimeout(decomposeTimerRef.current);
            }
            if (detectTimerRef.current !== null) {
                window.clearTimeout(detectTimerRef.current);
            }
            if (explainTimerRef.current !== null) {
                window.clearTimeout(explainTimerRef.current);
            }
            if (kbToastHideTimerRef.current !== null) {
                window.clearTimeout(kbToastHideTimerRef.current);
            }
            if (kbToastRemoveTimerRef.current !== null) {
                window.clearTimeout(kbToastRemoveTimerRef.current);
            }
        };
    }, []);

    

    // Create mapping between the event IDs and their corresponding log templates from the CSV file.
    useEffect(() => {
        if (demoMode) {
            setEventIdToLogTemplate(DEMO_EVENT_ID_TO_LOG_TEMPLATE);
        } else {
            fetch(withBase("structured_processes.csv"))
                .then(res => res.text())
                .then(csvText => {
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            const mapping: Record<string, string> = {};
                            for (const row of results.data as Record<string, string>[]) {
                                if (row.event_id && row.log_template) {
                                    mapping[String(row.event_id).trim()] = normalizeLabelText(String(row.log_template));
                                }
                            }
                            setEventIdToLogTemplate(mapping);
                        }
                    });
                });
        }
    }, [demoMode]);

    // Mark nodes in the tree as anomalies or related to anomalies based on the Krone detection data.
    useEffect(() => {
        if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= kroneDecompData.length) {
            setTreeData(null);
            setColumnHeaderPos(DEFAULT_COLUMN_HEADER_POS);
            setMultiLineAnomaly(false);
            resetKnowledgeBaseSequenceState();
            setShowSelectControl(hideSelectStep);
            setShowDecomposed(false);
            setShowDetected(false);
            resetDecomposingState();
            resetDetectingState();
            resetExplanationState();
            setLoading(false);
            setHoveredNode?.(null);
            if (svgRef.current) select(svgRef.current).selectAll("*").remove();
            return;
        }

        setLoading(true);
        // Clear selection in the side panel when loading a new sequence.
        setHoveredNode?.(null);
        resetExplanationState();
        const decomp = kroneDecompData[selectedIndex];
        const treeNode = toTreeNode(decomp, kroneDetectData, eventIdToLogTemplate, showDecomposed, showDetected);
        const anomalyRow = kroneDetectData.find(row => row.seq_id === decomp.seq_id);

        addIndexPath(treeNode); // Add index paths to the tree nodes
        setTreeData(treeNode); // Update the tree data state

        // Check if the anomaly row has multiple segments
        if (showDetected && anomalyRow && anomalyRow.anomaly_seg.length > 1) {
            setMultiLineAnomaly(true);
            setAnomalyLevelMulti(anomalyRow.anomaly_level || "Normal");
        } else {
            setMultiLineAnomaly(false);
        }
        setLoading(false);
    }, [kroneDecompData, kroneDetectData, selectedIndex, eventIdToLogTemplate, setHoveredNode, showDecomposed, showDetected, resetKnowledgeBaseSequenceState, hideSelectStep]);

    // Create the tree structure and render it using D3.js
    useEffect(() => {
        if (!svgRef.current) return;
        if (!treeData) {
            select(svgRef.current).selectAll("*").remove();
            return;
        }

        addIndexPath(treeData); // Ensure index paths are added to the tree nodes

        const root = hierarchy<TreeNode>(treeData, d => d.children); // Create a hierarchy from the tree data
        const completedActionPathSet = new Set(completedKnowledgeBaseActionPaths);
        const completedEntityPathSet = new Set(completedKnowledgeBaseEntityPaths);
        const activeEntitySequence = collectOrderedEntitySequences(treeData)
            .find((sequence) => sequence.pathKey === activeKnowledgeBaseEntityPath);
        const activeEntityActionPathSet = new Set(activeEntitySequence?.actionPathKeys ?? []);
        const activeActionLineNumbers = new Set(
            [
                ...(collectOrderedActionSequences(treeData)
                    .find((sequence) => sequence.pathKey === activeKnowledgeBaseActionPath)
                    ?.lineNumbers ?? []),
                ...(activeEntitySequence?.lineNumbers ?? []),
                ...(isActiveKnowledgeBaseRoot
                    ? collectOrderedActionSequences(treeData).flatMap((sequence) => sequence.lineNumbers)
                    : []),
            ]
        );

        const font = getCssVar('--font-WPIfont') || "sans-serif";
        const widestByDepth = getWidestByDepth(treeData, font); // Get the widest label width for each depth in the tree
        let stableWidestByDepth: number[] | null = null;
        let measurementTree = treeData;
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < kroneDecompData.length) {
            const decompForLayout = kroneDecompData[selectedIndex];
            const decomposedPreviewTree = toTreeNode(
                decompForLayout,
                kroneDetectData,
                eventIdToLogTemplate,
                true,
                showDetected
            );
            stableWidestByDepth = getWidestByDepth(decomposedPreviewTree, font);
            measurementTree = decomposedPreviewTree;
        }
        widestByDepth[1] = Math.max(widestByDepth[1] || 0, stableWidestByDepth?.[1] || 0, 118);
        widestByDepth[2] = Math.max(widestByDepth[2] || 0, stableWidestByDepth?.[2] || 0, 118);
        widestByDepth[3] = Math.max(widestByDepth[3] || 0, stableWidestByDepth?.[3] || 0, 118);

        const entitySpacing = 14; // Initial spacing between entities before topAlign
        const dy = Math.max(widestByDepth[1], widestByDepth[2]); // Spacing between actions and statuses

        // Create a D3 tree layout with specified node size and separation
        tree<TreeNode>().nodeSize([entitySpacing, dy]).separation((a, b) => (Math.max(getFontSize(a.depth), getFontSize(b.depth)) + 8) / DEPTH_SPACING)(root);

        // Align all the nodes to be top-aligned instead of centered-align
        function topAlign(node: HierarchyNode<TreeNode>) {
            if (node.children && node.children.length > 0) {
                node.children.forEach(topAlign);
                node.x = node.children[0].x;
            }
        }
        topAlign(root);

        const minEntityGap = 26; // Minimum gap between entities
        const entityNodes = root.children || [];
        // Ensure minimum gap between entity nodes
        for (let i = 1; i < entityNodes.length; i++) {
            const prev = entityNodes[i - 1];
            const curr = entityNodes[i];
            // If the gap between current and previous entity nodes is less than the minimum, offset the current node and all subsequent nodes
            if (curr.x! - prev.x! < minEntityGap) {
                const offset = minEntityGap - (curr.x! - prev.x!);
                // Function to offset the subtree of a node
                function offsetSubtree(node: HierarchyNode<TreeNode>, delta: number) {
                    node.x! += delta;
                    if (node.children) node.children.forEach(child => offsetSubtree(child, delta));
                }
                offsetSubtree(curr, offset);
                // Offset all subsequent nodes in the entityNodes array
                for (let j = i + 1; j < entityNodes.length; j++) {
                    offsetSubtree(entityNodes[j], offset);
                }
            }
        }

        const extraColSpacing = [0, 6, 8, 8]; // Extra spacing for each depth
        const colOffsets = [0];
        // Calculate the cumulative offsets for each column based on the widest label at that depth
        for (let i = 1; i < widestByDepth.length; i++) {
            colOffsets[i] = (colOffsets[i - 1] || 0) + widestByDepth[i - 1] + extraColSpacing[i];
        }

        root.each(node => {
            node.y = colOffsets[node.depth];
        });
        let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        // Calculate the bounding box of the tree
        root.each(d => {
            if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
            if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
            if ((d.y ?? 0) > y1) y1 = d.y ?? 0;
        });

        let maxStatusLabelRight = 0;
        let maxIndexWidth = 0;
        let maxLogKeyWidth = 0;
        let maxLogTemplateTextWidth = 0;
        const nodeRectWidthByPath = new Map<string, number>();

        // Create a temporary SVG to measure the width of status labels and log columns.
        const tempSvg2 = select(document.body).append("svg").attr("style", "position: absolute; visibility: hidden;").attr("font-family", font);
        const headerFontSize = 18;
        const getHeaderWidth = (headerText: string) => {
            const t = tempSvg2.append("text")
                .attr("font-size", headerFontSize)
                .attr("font-weight", 400)
                .attr("font-family", font)
                .text(headerText);
            const w = (t.node() as SVGTextElement).getBBox().width;
            t.remove();
            return w;
        };
        const getNodeRectWidth = (label: string, depth: number) => {
            const fontSize = getFontSize(depth);
            const t = tempSvg2.append("text")
                .attr("font-size", fontSize)
                .attr("font-family", font)
                .text(label);
            const w = (t.node() as SVGTextElement).getBBox().width;
            t.remove();
            return Math.max(w + getPadding(fontSize) * 2, 52);
        };
        const indexHeaderWidth = getHeaderWidth("Index");
        const logKeyHeaderWidth = getHeaderWidth("Log Key");
        const logTemplateHeaderWidth = getHeaderWidth("Log Template");
        root.descendants().forEach(node => {
            if (node.depth < 1 || node.depth > 3) return;
            const pathKey = (node.data.indexPath || []).join(".");
            if (!pathKey) return;
            nodeRectWidthByPath.set(pathKey, getNodeRectWidth(node.data.name || "", node.depth));
        });
        
        // Measure the width of each depth-3 row's status/index/log-key/log-template content.
        const measurementRoot = hierarchy<TreeNode>(measurementTree, d => d.children);
        measurementRoot.descendants().forEach(node => {
            if (node.depth === 3) {
                const fontSize = getFontSize(node.depth);
                const valueFontSize = Math.max(fontSize * 0.9, 12);

                const tempStatusText = tempSvg2.append("text")
                    .attr("font-size", fontSize)
                    .attr("font-family", font)
                    .text(node.data.name);
                const statusBBox = (tempStatusText.node() as SVGTextElement).getBBox();
                const statusRightEdge = statusBBox.x + statusBBox.width + getPadding(fontSize);
                if (statusRightEdge > maxStatusLabelRight) maxStatusLabelRight = statusRightEdge;
                tempStatusText.remove();

                const indexText = typeof node.data.lineNumber === "number" ? String(node.data.lineNumber) : "-";
                const indexMeasure = tempSvg2.append("text")
                    .attr("font-size", valueFontSize)
                    .attr("font-family", font)
                    .text(indexText);
                const indexWidth = (indexMeasure.node() as SVGTextElement).getBBox().width;
                if (indexWidth > maxIndexWidth) maxIndexWidth = indexWidth;
                indexMeasure.remove();

                const eventId = node.data.event_id || "-";
                const keyMeasure = tempSvg2.append("text")
                    .attr("font-size", valueFontSize)
                    .attr("font-family", font)
                    .text(eventId);
                const keyWidth = (keyMeasure.node() as SVGTextElement).getBBox().width;
                if (keyWidth > maxLogKeyWidth) maxLogKeyWidth = keyWidth;
                keyMeasure.remove();

                const logTemplate = eventIdToLogTemplate[node.data.event_id || ""] || node.data.log_template || "-";
                const templateMeasure = tempSvg2.append("text")
                    .attr("font-size", valueFontSize)
                    .attr("font-family", font)
                    .text(logTemplate);
                const templateWidth = (templateMeasure.node() as SVGTextElement).getBBox().width;
                if (templateWidth > maxLogTemplateTextWidth) maxLogTemplateTextWidth = templateWidth;
                templateMeasure.remove();
            }
        });
        maxStatusLabelRight = Math.max(maxStatusLabelRight, widestByDepth[3]);
        tempSvg2.remove();

        const statusToIndexGap = 14;
        const columnGap = 24;
        const indexColumnWidth = Math.max(maxIndexWidth, indexHeaderWidth) + 12;
        const logKeyColumnWidth = Math.max(maxLogKeyWidth, logKeyHeaderWidth) + 12;
        const logTemplateColumnWidth = Math.max(maxLogTemplateTextWidth, logTemplateHeaderWidth);
        const threeColumnWidth = indexColumnWidth + columnGap + logKeyColumnWidth + columnGap + logTemplateColumnWidth;
        const showTreeColumns = showDecomposed;
        const maxLogTemplateRight =
            maxStatusLabelRight +
            statusToIndexGap +
            indexColumnWidth +
            columnGap +
            logKeyColumnWidth +
            columnGap +
            logTemplateColumnWidth;

        // Adjust the width to show all of the log template
        const adjustedWidth = maxLogTemplateRight + 600
        const height = x1 - x0 + BASE_FONT * 2;

        // Initialize the SVG element with the calculated dimensions and font
        const svgWidth = adjustedWidth + 120;
        // Keep only a small vertical breathing room; remove old extra header space.
        let svg = svgInit(svgRef, svgWidth, height + 40, font, -40, x0);
        // Keep a 1:1 horizontal coordinate system with sticky headers (no responsive squeeze).
        svg.style("max-width", "none");
        // Append header text to the sticky HTML header

        const entityX = colOffsets[1] ?? DEFAULT_COLUMN_HEADER_POS.entityX;
        const actionX = colOffsets[2] ?? DEFAULT_COLUMN_HEADER_POS.actionX;
        const statusX = colOffsets[3] ?? DEFAULT_COLUMN_HEADER_POS.statusX;
        const centeredStartX = Math.max(24, (svgWidth - threeColumnWidth) / 2);
        const indexX = showTreeColumns ? (statusX + maxStatusLabelRight + statusToIndexGap) : centeredStartX;
        const logKeyX = indexX + indexColumnWidth + columnGap;
        const logTemplateX = logKeyX + logKeyColumnWidth + columnGap;

        setColumnHeaderPos({
            entityX,
            actionX,
            statusX,
            indexX,
            indexW: indexColumnWidth,
            logKeyX,
            logKeyW: logKeyColumnWidth,
            logTemplateX,
            logTemplateW: logTemplateColumnWidth,
            contentWidth: svgWidth,
        });

        if (showDecomposed) {
            svg = svgLines(svg, root, widestByDepth, (node) => {
                const pathKey = (node.data.indexPath || []).join(".");
                return nodeRectWidthByPath.get(pathKey) ?? widestByDepth[node.depth];
            });
        }
        
        // Append nodes to the SVG
        const node = svgNodes(
            svg,
            root,
            // mouseover
            function (this: SVGElement, event, d) {
                highlightText.call(this, event, d);
            },
            // mouseout
            function (this: SVGElement) {
                unhighlightText.call(this);
            },
            // click
            function (this: SVGElement, event, d) {
                event.stopPropagation();
                setHoveredNode?.(d);
            }
        );

        // Function to highlight text and links related to the hovered node
        function highlightText(this: SVGElement, _event: unknown, d: HierarchyNode<TreeNode>) {
            if (isSavingStatusSequence) return;
            const relatedNodes = new Set<HierarchyNode<TreeNode>>();
            const relatedStatusNodes = d.descendants().filter((node) => node.depth === 3);
            const relatedLineNumbers = new Set(
                relatedStatusNodes
                    .map((node) => node.data.lineNumber)
                    .filter((lineNumber): lineNumber is number => typeof lineNumber === "number")
            );
            if (hideDetectAndExplainSteps) {
                d.descendants().forEach((node) => relatedNodes.add(node));
            } else {
                let current: HierarchyNode<TreeNode> | null = d;
                while (current) {
                    relatedNodes.add(current);
                    current = current.parent;
                }
            }

            // Highlight the text and links related to the hovered node
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function (n) {
                    const isRelated = relatedNodes.has(n);
                    const isRelatedAnomaly = isRelated && !!n.data.isAnomaly;
                    const pathKey = (n.data.indexPath || []).join(".");
                    const isActiveRoot = n.depth === 0 && isActiveKnowledgeBaseRoot;
                    const isCompletedRoot = n.depth === 0 && isCompletedKnowledgeBaseRoot;
                    const isCompletedEntity = n.depth === 1 && completedEntityPathSet.has(pathKey);
                    const isActiveEntity = n.depth === 1 && pathKey === activeKnowledgeBaseEntityPath;
                    const isActiveEntityAction = n.depth === 2 && activeEntityActionPathSet.has(pathKey);
                    select(this)
                        .attr("fill",
                            isCompletedRoot || isCompletedEntity
                                ? "#166534"
                                : isActiveRoot || isActiveEntity || isActiveEntityAction
                                    ? "var(--highlight-text)"
                                    : isRelatedAnomaly
                                ? "#F00"
                                : (isRelated ? "var(--highlight-text)" : (n.data.isAnomaly ? "#F00" : "#222"))
                        );
                    const rects = select(this.parentNode as Element).selectAll("rect").nodes();
                    if (rects.length > 0) {
                        select(rects[0])
                            .attr("fill", isActiveRoot || isActiveEntity || isActiveEntityAction || isRelated ? "var(--highlight-fill)" : isCompletedRoot || isCompletedEntity ? "#f0fdf4" : NODE_STYLE_FILL)
                            .attr("stroke", isActiveRoot || isActiveEntity || isActiveEntityAction || isRelated ? "var(--highlight-fill)" : isCompletedRoot || isCompletedEntity ? "#22c55e" : NODE_STYLE_STROKE)
                            .attr("stroke-width", isActiveRoot || isActiveEntity || isActiveEntityAction || isRelated ? 5 : isCompletedRoot || isCompletedEntity ? 3 : 2);
                    }
                });

            svg.selectAll<SVGTextElement, TreeNode>("text.auxiliary-status-text")
                .each(function (row) {
                    const isRelated = typeof row.lineNumber === "number" && relatedLineNumbers.has(row.lineNumber);
                    const defaultColor = (row.isAnomaly || row.isRelatedToAnomaly) ? "#F00" : "#000";
                    select(this)
                        .attr("fill", isRelated ? "var(--highlight-text)" : defaultColor)
                        .attr("font-weight", isRelated ? 700 : ((row.isAnomaly || row.isRelatedToAnomaly) ? 600 : 400));
                });

            // Highlight links based on ancestor and descendant relationships
            if (showDecomposed) {
                svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                    .attr("stroke", lnk => {
                        const isRelatedPath =
                            relatedNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                            relatedNodes.has(lnk.target as HierarchyNode<TreeNode>);
                        return isRelatedPath ? "var(--highlight-fill)" : linkBorderColor(lnk);
                    })
                    .attr("stroke-width", lnk => {
                        const isRelatedPath =
                            relatedNodes.has(lnk.source as HierarchyNode<TreeNode>) &&
                            relatedNodes.has(lnk.target as HierarchyNode<TreeNode>);
                        return isRelatedPath ? 5 : 1.5;
                    });
            }
        }

        // Function to unhighlight text and links when the mouse leaves the node
        function unhighlightText(this: SVGElement) {
            if (isSavingStatusSequence) return;
            svg.selectAll<SVGTextElement, HierarchyNode<TreeNode>>("text.node-label")
                .each(function (n) {
                    const pathKey = (n.data.indexPath || []).join(".");
                    const isCompletedRoot = n.depth === 0 && isCompletedKnowledgeBaseRoot;
                    const isActiveRoot = n.depth === 0 && isActiveKnowledgeBaseRoot;
                    const isCompletedAction = n.depth === 2 && completedActionPathSet.has(pathKey);
                    const isCompletedEntity = n.depth === 1 && completedEntityPathSet.has(pathKey);
                    const isActiveEntity = n.depth === 1 && pathKey === activeKnowledgeBaseEntityPath;
                    const isActiveEntityAction = n.depth === 2 && activeEntityActionPathSet.has(pathKey);
                    select(this)
                        .attr("fill", n.data.isAnomaly ? "#F00" : isCompletedRoot || isCompletedEntity || isCompletedAction ? "#166534" : isActiveRoot || isActiveEntity || isActiveEntityAction ? "var(--highlight-text)" : "#000");
                    // Only update the first rect (the node label background), not all rects in the group
                    const rects = select(this.parentNode as Element).selectAll("rect").nodes();
                    if (rects.length > 0) {
                        select(rects[0])
                            .attr("fill", isActiveRoot || isActiveEntity || isActiveEntityAction ? "var(--highlight-fill)" : isCompletedRoot || isCompletedEntity || isCompletedAction ? "#f0fdf4" : NODE_STYLE_FILL)
                            .attr("stroke", isActiveRoot || isActiveEntity || isActiveEntityAction ? "var(--highlight-fill)" : isCompletedRoot || isCompletedEntity || isCompletedAction ? "#22c55e" : NODE_STYLE_STROKE)
                            .attr("stroke-width", isActiveRoot || isActiveEntity || isActiveEntityAction ? 5 : isCompletedRoot || isCompletedEntity || isCompletedAction ? 3 : 2);
                    }
                });
            svg.selectAll<SVGTextElement, TreeNode>("text.auxiliary-status-text")
                .attr("fill", d => {
                    const isActive = typeof d.lineNumber === "number" && activeActionLineNumbers.has(d.lineNumber);
                    if (isActive) return "var(--highlight-text)";
                    return (d.isAnomaly || d.isRelatedToAnomaly) ? "#F00" : "#000";
                })
                .attr("font-weight", d => {
                    const isActive = typeof d.lineNumber === "number" && activeActionLineNumbers.has(d.lineNumber);
                    if (isActive) return 700;
                    return (d.isAnomaly || d.isRelatedToAnomaly) ? 600 : 400;
                });
            if (showDecomposed) {
                svg.selectAll<SVGPathElement, HierarchyLink<TreeNode>>("path")
                    .attr("stroke", linkBorderColor)
                    .attr("stroke-width", 1.5);
            }
        }

        let anomalyStartY = Infinity;
        let anomalyEndY = -Infinity;

        // Render the nodes with labels and additional elements
        node.append("text")
            .attr("class", "node-label")
            .attr("dy", "0.31em")
            // Position the text based on the node's depth and whether it has children
            .attr("x", (d: HierarchyNode<TreeNode>) => {
                const fontSize = getFontSize(d.depth);
                return (d.children ? -fontSize * 0.2 : fontSize * 0.2);
            })
            .attr("opacity", (d: HierarchyNode<TreeNode>) => {
                if (!showDecomposed && d.depth === 0) return 0;
                if (!showDecomposed && d.depth >= 1 && d.depth <= 3) return 0;
                return isNodeHidden(d) ? 0 : 1;
            }) // Hide text if the node is hidden
            .attr("pointer-events", (d: HierarchyNode<TreeNode>) => isNodeHidden(d) ? "none" : "auto") // Disable pointer events if the node is hidden
            .attr("text-anchor", "start")
            .text((d: HierarchyNode<TreeNode>) => normalizeLabelText(d.data.name)) // Set the text content to the node's name
            .attr("fill", (d: HierarchyNode<TreeNode>) => d.data.isAnomaly ? "#F00" : "#222")
            .attr("font-size", (d: HierarchyNode<TreeNode>) => getFontSize(d.depth))
            .style("white-space", "nowrap")
            .each(function (this: SVGTextElement, d: HierarchyNode<TreeNode>) {
                const fontSize = getFontSize(d.depth), padding = getPadding(fontSize), radius = getRadius(fontSize);
                const nodeGroup = select(this.parentNode as Element);
                const bbox = this.getBBox();
                const pathKey = (d.data.indexPath || []).join(".");
                const isActiveKnowledgeBaseRootNode = d.depth === 0 && isActiveKnowledgeBaseRoot;
                const isCompletedKnowledgeBaseRootNode = d.depth === 0 && isCompletedKnowledgeBaseRoot;
                const isActiveKnowledgeBaseEntity = d.depth === 1 && pathKey === activeKnowledgeBaseEntityPath;
                const isCompletedKnowledgeBaseEntity = d.depth === 1 && completedEntityPathSet.has(pathKey);
                const isActiveKnowledgeBaseAction = d.depth === 2 && pathKey === activeKnowledgeBaseActionPath;
                const isActiveKnowledgeBaseEntityAction = d.depth === 2 && activeEntityActionPathSet.has(pathKey);
                const isCompletedKnowledgeBaseAction = d.depth === 2 && completedActionPathSet.has(pathKey);
                const isActiveKnowledgeBaseStatus = d.depth === 3 && typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber);
                // Calculate the width of the node label and adjust the rectangle accordingly
                if (d.depth === 0 && showDecomposed) {
                    const rectWidth = Math.max(bbox.width + padding * 2, 52);
                    nodeGroup.insert("rect", "text")
                        .attr("x", bbox.x - padding)
                        .attr("y", bbox.y - padding / 2)
                        .attr("width", rectWidth)
                        .attr("height", bbox.height + padding)
                        .attr("fill", isActiveKnowledgeBaseRootNode ? "var(--highlight-fill)" : isCompletedKnowledgeBaseRootNode ? "#f0fdf4" : NODE_STYLE_FILL)
                        .attr("stroke", isActiveKnowledgeBaseRootNode ? "var(--highlight-fill)" : isCompletedKnowledgeBaseRootNode ? "#22c55e" : NODE_STYLE_STROKE)
                        .attr("stroke-width", isActiveKnowledgeBaseRootNode ? 5 : isCompletedKnowledgeBaseRootNode ? 3 : 2)
                        .attr("rx", radius)
                        .attr("ry", radius);
                } else if (showDecomposed && d.depth >= 1 && d.depth <= 3) {
                    const pathKey = (d.data.indexPath || []).join(".");
                    const rectWidth = nodeRectWidthByPath.get(pathKey) ?? Math.max(bbox.width + padding * 2, 52);
                    nodeGroup.insert("rect", "text")
                        .attr("x", bbox.x - padding)
                        .attr("y", bbox.y - padding / 2)
                        .attr("width", rectWidth)
                        .attr("height", bbox.height + padding)
                        .attr("fill", isActiveKnowledgeBaseEntity || isActiveKnowledgeBaseAction || isActiveKnowledgeBaseEntityAction || isActiveKnowledgeBaseStatus ? "var(--highlight-fill)" : isCompletedKnowledgeBaseEntity || isCompletedKnowledgeBaseAction ? "#f0fdf4" : NODE_STYLE_FILL)
                        .attr("stroke", isActiveKnowledgeBaseEntity || isActiveKnowledgeBaseAction || isActiveKnowledgeBaseEntityAction || isActiveKnowledgeBaseStatus ? "var(--highlight-fill)" : isCompletedKnowledgeBaseEntity || isCompletedKnowledgeBaseAction ? "#22c55e" : NODE_STYLE_STROKE)
                        .attr("stroke-width", isActiveKnowledgeBaseEntity || isActiveKnowledgeBaseAction || isActiveKnowledgeBaseEntityAction || isActiveKnowledgeBaseStatus ? 5 : isCompletedKnowledgeBaseEntity || isCompletedKnowledgeBaseAction ? 3 : 2)
                        .attr("rx", radius)
                        .attr("ry", radius);
                }

                if (isActiveKnowledgeBaseRootNode || isCompletedKnowledgeBaseRootNode || isActiveKnowledgeBaseEntity || isCompletedKnowledgeBaseEntity || isActiveKnowledgeBaseAction || isActiveKnowledgeBaseEntityAction || isCompletedKnowledgeBaseAction || isActiveKnowledgeBaseStatus) {
                    select(this)
                        .attr("fill", isCompletedKnowledgeBaseRootNode || isCompletedKnowledgeBaseEntity || isCompletedKnowledgeBaseAction ? "#166534" : "var(--highlight-text)")
                        .attr("font-weight", 700);
                }

                // If the node is at depth 3, render the log template text
                if (d.depth === 3) {
                    const eventId = d.data.event_id || "-";
                    const logTemplate = eventIdToLogTemplate[d.data.event_id || ""] || d.data.log_template || "-";
                    const y = bbox.y + bbox.height / 2 + 2;
                    const fontSizeLog = Math.max(fontSize * 0.9, 12);
                    const isAnomalyRelatedRow = !!d.data.isAnomaly || !!d.data.isRelatedToAnomaly;
                    const valueColor = isAnomalyRelatedRow ? "#F00" : "#000";
                    const nodeBaseX = d.y ?? 0;
                    const indexTextX = indexX - nodeBaseX;
                    const logKeyTextX = logKeyX - nodeBaseX;
                    const logTemplateTextX = logTemplateX - nodeBaseX;

                    nodeGroup.append("text")
                        .attr("class", "index-text auxiliary-status-text")
                        .attr("data-line-number", d.data.lineNumber || "")
                        .attr("x", indexTextX)
                        .attr("y", y)
                        .attr("alignment-baseline", "middle")
                        .attr("font-size", fontSizeLog)
                        .attr("fill", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? "var(--highlight-text)" : valueColor)
                        .attr("font-weight", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? 700 : isAnomalyRelatedRow ? 600 : 400)
                        .attr("text-anchor", "start")
                        .style("white-space", "nowrap")
                        .text(typeof d.data.lineNumber === "number" ? String(d.data.lineNumber) : "-")
                        .datum({
                            ...d.data
                        });

                    nodeGroup.append("text")
                        .attr("class", "log-key-text auxiliary-status-text")
                        .attr("data-line-number", d.data.lineNumber || "")
                        .attr("data-event-id", eventId)
                        .attr("x", logKeyTextX)
                        .attr("y", y)
                        .attr("alignment-baseline", "middle")
                        .attr("font-size", fontSizeLog)
                        .attr("fill", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? "var(--highlight-text)" : valueColor)
                        .attr("font-weight", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? 700 : isAnomalyRelatedRow ? 600 : 400)
                        .attr("text-anchor", "start")
                        .style("white-space", "nowrap")
                        .text(eventId)
                        .datum({
                            ...d.data
                        });

                    nodeGroup.append("text")
                        .attr("class", "log-template-text auxiliary-status-text")
                        .attr("data-event-id", eventId)
                        .attr("data-line-number", d.data.lineNumber || "")
                        .attr("x", logTemplateTextX)
                        .attr("y", y)
                        .attr("alignment-baseline", "middle")
                        .attr("font-size", fontSizeLog)
                        .attr("fill", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? "var(--highlight-text)" : valueColor)
                        .attr("font-weight", typeof d.data.lineNumber === "number" && activeActionLineNumbers.has(d.data.lineNumber) ? 700 : isAnomalyRelatedRow ? 600 : 400)
                        .attr("text-anchor", "start")
                        .style("white-space", "nowrap")
                        .text(normalizeLabelText(logTemplate))
                        .datum({
                            ...d.data
                        });
                }

                // If the node is an anomaly, calculate the bounding box and position the anomaly warning icon
                if (d.data.isAnomaly) {
                    const g = this.parentNode as SVGGElement;
                    const transform = g.getAttribute("transform");
                    if (transform) {
                        const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
                        if (match) {
                            const y = parseFloat(match[2]);
                            if (y < anomalyStartY) anomalyStartY = y;
                            if (y > anomalyEndY) anomalyEndY = y;
                        }
                    }
                }
                // If the node is an anomaly and its parents are expanded, append a warning icon
                if (showDecomposed && d.data.isAnomaly && !d.parent?.data.collapsed && !d.parent?.parent?.data.collapsed) {
                    if (!multiLineAnomaly) {
                        nodeGroup.append("text")
                            .attr("class", "anomaly-warning")
                            .attr("x", bbox.x - padding * 2.5 - 15)
                            .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
                            .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
                            .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
                            .attr("fill", "#FFD100")
                            .attr("font-weight", 400)
                            .attr("text-anchor", "start")
                            .style("cursor", "pointer")
                            .text("⚠️")
                    }
                }

                // If the node is related to an anomaly and collapsed, append a warning icon
                else if (showDecomposed && d.data.isRelatedToAnomaly && d.data.collapsed && !d.parent?.data.collapsed) {
                    const reason = getFirstAnomalyReason(d);
                    nodeGroup.append("text")
                        .attr("class", "anomaly-warning")
                        .attr("x", bbox.x - padding * 2.5 - 15)
                        .attr("y", d.depth === 3 ? bbox.y + bbox.height / 2 + 2 : bbox.y - padding / 2 + 8)
                        .attr("alignment-baseline", d.depth === 3 ? "middle" : "hanging")
                        .attr("font-size", Math.max(fontSize * 0.8, d.depth === 3 ? 14 : 18))
                        .attr("fill", "#FFD100")
                        .attr("text-anchor", "start")
                        .style("cursor", "pointer")
                        .text(!reason ? "" : multiLineAnomaly ? "🚨" : "⚠️")
                }

                if (d.depth === 2 && isCompletedKnowledgeBaseAction) {
                    const badgeSize = 16;
                    const badgeX = bbox.x + bbox.width + padding + 10;
                    const badgeY = bbox.y + bbox.height / 2 + 1;
                    nodeGroup.append("circle")
                        .attr("cx", badgeX)
                        .attr("cy", badgeY)
                        .attr("r", badgeSize / 2)
                        .attr("fill", "#22c55e")
                        .attr("stroke", "#16a34a")
                        .attr("stroke-width", 1.5);
                    nodeGroup.append("text")
                        .attr("x", badgeX)
                        .attr("y", badgeY + 0.5)
                        .attr("alignment-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .attr("font-size", 10)
                        .attr("font-weight", 700)
                        .attr("fill", "#fff")
                        .text("✓");
                }

                if (d.depth === 1 && isCompletedKnowledgeBaseEntity) {
                    const badgeSize = 16;
                    const badgeX = bbox.x + bbox.width + padding + 10;
                    const badgeY = bbox.y + bbox.height / 2 + 1;
                    nodeGroup.append("circle")
                        .attr("cx", badgeX)
                        .attr("cy", badgeY)
                        .attr("r", badgeSize / 2)
                        .attr("fill", "#22c55e")
                        .attr("stroke", "#16a34a")
                        .attr("stroke-width", 1.5);
                    nodeGroup.append("text")
                        .attr("x", badgeX)
                        .attr("y", badgeY + 0.5)
                        .attr("alignment-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .attr("font-size", 10)
                        .attr("font-weight", 700)
                        .attr("fill", "#fff")
                        .text("✓");
                }

                if (d.depth === 0 && isCompletedKnowledgeBaseRootNode) {
                    const badgeSize = 16;
                    const badgeX = bbox.x + bbox.width + padding + 10;
                    const badgeY = bbox.y + bbox.height / 2 + 1;
                    nodeGroup.append("circle")
                        .attr("cx", badgeX)
                        .attr("cy", badgeY)
                        .attr("r", badgeSize / 2)
                        .attr("fill", "#22c55e")
                        .attr("stroke", "#16a34a")
                        .attr("stroke-width", 1.5);
                    nodeGroup.append("text")
                        .attr("x", badgeX)
                        .attr("y", badgeY + 0.5)
                        .attr("alignment-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .attr("font-size", 10)
                        .attr("font-weight", 700)
                        .attr("fill", "#fff")
                        .text("✓");
                }
            });

        
        const anyVisibleAnomalyNode = root.descendants().some(
            node => (node.data.isAnomaly) && !isNodeHidden(node) // Check if the node is an anomaly and not hidden
        );

        // If there are multi-line anomalies, draw a highlight rectangle around the anomaly nodes
        // This is only done if there are any visible anomaly nodes
        if (
            showDecomposed &&
            multiLineAnomaly &&
            anomalyStartY !== Infinity &&
            anomalyEndY !== -Infinity &&
            anyVisibleAnomalyNode
        ) {
            let highlightYStart = anomalyStartY;
            let highlightYEnd = anomalyEndY;
            let leftX: number, rightX: number;

            if (anomalyLevelMulti === "entity") {
                const y = getEntityHighlightY(root, getFontSize, getPadding);
                if (y) {
                    highlightYStart = y.highlightYStart;
                    highlightYEnd = y.highlightYEnd;
                }
                leftX = colOffsets[1];
                rightX = colOffsets[1] + widestByDepth[1];
            } else if (anomalyLevelMulti === "action") {
                const y = getActionHighlightY(root, getFontSize, getPadding);
                if (y) {
                    highlightYStart = y.highlightYStart;
                    highlightYEnd = y.highlightYEnd!;
                }
                leftX = colOffsets[2];
                rightX = colOffsets[2] + widestByDepth[2];
            } else {
                leftX = colOffsets[3];
                rightX = colOffsets[3] + widestByDepth[3];
            }
            const rectWidth = rightX - leftX;

            if (anomalyLevelMulti === "status") {
                highlightYEnd += 15;
            }

            const highlightRectX = leftX - 20;
            const highlightRectY = highlightYStart - 20;
            const highlightRectWidth = rectWidth + 25;
            const highlightRectHeight = highlightYEnd - highlightYStart + 20;

            // Draw the highlight rectangle around the anomaly nodes
            svg.append("rect")
                .attr("x", highlightRectX)
                .attr("y", highlightRectY)
                .attr("width", highlightRectWidth)
                .attr("height", highlightRectHeight)
                .attr("fill", "#FFCCCC")
                .attr("stroke", "#FF0000")
                .attr("fill-opacity", 0.2)
                .attr("pointer-events", "none")
                .lower();

            const explainBtnWidth = 74;
            const explainBtnHeight = 22;
            const explainBtnX = Math.max(8, highlightRectX);
            const explainBtnY = highlightRectY + highlightRectHeight + 6;
            const explainBtn = svg.append("g")
                .attr("class", "anomaly-llm-explain-button")
                .attr("transform", `translate(${explainBtnX},${explainBtnY})`)
                .style("cursor", "pointer")
                .on("click", function (event: MouseEvent) {
                    event.stopPropagation();
                    if (explainTimerRef.current !== null) {
                        window.clearTimeout(explainTimerRef.current);
                        explainTimerRef.current = null;
                    }
                    setIsExplaining(false);
                    setShowAnomalyExplanation(true);
                });

            explainBtn.append("rect")
                .attr("width", explainBtnWidth)
                .attr("height", explainBtnHeight)
                .attr("rx", 6)
                .attr("ry", 6)
                .attr("fill", "rgba(255,255,255,0.72)")
                .attr("stroke", "rgba(239,68,68,0.75)");

            explainBtn.append("text")
                .attr("x", explainBtnWidth / 2)
                .attr("y", explainBtnHeight / 2 + 1)
                .attr("alignment-baseline", "middle")
                .attr("text-anchor", "middle")
                .attr("font-size", 12)
                .attr("font-weight", 600)
                .attr("fill", "rgba(185,28,28,0.9)")
                .text("✨ LLM");
        }

        node.each(function (d: HierarchyNode<TreeNode>) {// Update the opacity and pointer-events of the rectangles based on node visibility
            if (!this) return;
            const hidden: boolean = isNodeHidden(d);
            select(this).selectAll<SVGRectElement, unknown>("rect")
            .attr("opacity", hidden ? 0 : 1)
            .attr("pointer-events", hidden ? "none" : "auto");
        });

    }, [
        treeData,
        eventIdToLogTemplate,
        multiLineAnomaly,
        showDecomposed,
        showDetected,
        selectedIndex,
        kroneDecompData,
        kroneDetectData,
        activeKnowledgeBaseActionPath,
        completedKnowledgeBaseActionPaths,
        activeKnowledgeBaseEntityPath,
        completedKnowledgeBaseEntityPaths,
        isActiveKnowledgeBaseRoot,
        isCompletedKnowledgeBaseRoot,
        isSavingStatusSequence,
    ]);

    const selectedSeqId = selectedIndex === null ? undefined : kroneDecompData[selectedIndex]?.seq_id; // Get the selected sequence ID from the decomposition data
    const abnormalSeqIdSet = useMemo(() => {
        return new Set(kroneDetectData.map((row) => row.seq_id));
    }, [kroneDetectData]);
    const abnormalSequenceCount = useMemo(() => {
        return kroneDecompData.reduce((count, row) => (
            abnormalSeqIdSet.has(row.seq_id) ? count + 1 : count
        ), 0);
    }, [kroneDecompData, abnormalSeqIdSet]);
    const resolvedTotalSequenceCount = totalSequenceCount ?? kroneDecompData.length;
    const resolvedVisibleSequenceCount = visibleSequenceCount ?? kroneDecompData.length;
    const sortedSequenceRows = useMemo(() => {
        return kroneDecompData
            .sort((a, b) => {
                const aAbnormal = abnormalSeqIdSet.has(a.seq_id);
                const bAbnormal = abnormalSeqIdSet.has(b.seq_id);
                if (aAbnormal !== bAbnormal) return aAbnormal ? -1 : 1;
                return a.seq_id.localeCompare(b.seq_id, undefined, { numeric: true, sensitivity: "base" });
            });
    }, [kroneDecompData, abnormalSeqIdSet]);
    const selectedDecomp = selectedIndex === null ? undefined : kroneDecompData[selectedIndex];
    const anomalyRowsForSeq = kroneDetectData.filter(row => row.seq_id === selectedSeqId);
    const anomalyRow = anomalyRowsForSeq[0] || undefined; // Find the anomaly row corresponding to the selected sequence ID
    const anomalyLogKeysForSeq = anomalyRowsForSeq.flatMap(row => row.anomaly_seg).filter(Boolean);
    const anomalyLogKeysText = anomalyLogKeysForSeq.join(", ");
    const anomalySegmentLinkText = `[${anomalyLogKeysText}]`;
    const anomalyStartLine = (() => {
        const sequence = selectedDecomp?.seq || [];
        if (!sequence.length || !anomalyRowsForSeq.length) return null;
        for (const row of anomalyRowsForSeq) {
            const seg = row.anomaly_seg || [];
            if (!seg.length) continue;
            for (let i = 0; i <= sequence.length - seg.length; i++) {
                if (arraysEqual(sequence.slice(i, i + seg.length), seg)) {
                    return i;
                }
            }
        }
        return null;
    })();
    const anomalyExplanationText = anomalyRow?.anomaly_reason || "-";
    let anomalyLevel = "-";
    if (selectedSeqId && showDetected) {
        anomalyLevel = "Normal";
        if (anomalyRow && anomalyRow.anomaly_level) {
            if (anomalyRow.anomaly_level === "entity") anomalyLevel = "Abnormal";
            else if (anomalyRow.anomaly_level === "action") anomalyLevel = "Abnormal";
            else if (anomalyRow.anomaly_level === "status") anomalyLevel = "Abnormal";
            else anomalyLevel = String(anomalyRow.anomaly_level);
        }
    }
    const anomalyLevelBadgeText = (() => {
        if (anomalyLevel !== "Abnormal" || !anomalyRow?.anomaly_level) return null;
        const levelRaw = String(anomalyRow.anomaly_level).trim();
        if (!levelRaw) return null;
        const level = levelRaw.charAt(0).toUpperCase() + levelRaw.slice(1).toLowerCase();
        return `${level} level`;
    })();
    const anomalyLevelText = (() => {
        const levelRaw = String(anomalyRow?.anomaly_level ?? "").trim();
        if (!levelRaw) return "-";
        return `${levelRaw.charAt(0).toUpperCase()}${levelRaw.slice(1).toLowerCase()}`;
    })();
    const anomalyParentNodeText = (() => {
        if (!selectedDecomp || anomalyStartLine === null || !anomalyRow?.anomaly_level) return "-";
        if (anomalyRow.anomaly_level === "status") {
            const actionName = normalizeLabelText(selectedDecomp.action_nodes_for_logkeys[anomalyStartLine]) || "-";
            return `${actionName} (Action)`;
        }
        if (anomalyRow.anomaly_level === "action") {
            const entityName = normalizeLabelText(selectedDecomp.entity_nodes_for_logkeys[anomalyStartLine]) || "-";
            return `${entityName} (Entity)`;
        }
        if (anomalyRow.anomaly_level === "entity") {
            return "Root (Root)";
        }
        return "-";
    })();

    type FlowStepId = "select" | "decompose" | "detect" | "explain";
    const canDecompose = !!selectedSeqId && !showDecomposed && !isDecomposing;
    const canDetect = !!selectedSeqId && showDecomposed && !showDetected && !isDetecting && !isDecomposing;
    const canExplain = showDetected && anomalyLevel === "Abnormal" && anomalyLogKeysForSeq.length > 0;
    const canAddToKnowledgeBase = hideDetectAndExplainSteps
        ? !!selectedSeqId && showDecomposed
        : showDetected && anomalyLevel === "Abnormal" && anomalyLogKeysForSeq.length > 0;
    const resolvedKnowledgeBaseButtons = knowledgeBaseActionButtons?.length
        ? knowledgeBaseActionButtons
        : [{ id: "default", label: knowledgeBaseActionLabel, toastMessage: "abnormal segment has been added to knowledge base!" }];
    const orderedActionSequences = useMemo(() => collectOrderedActionSequences(treeData), [treeData]);
    const orderedEntitySequences = useMemo(() => collectOrderedEntitySequences(treeData), [treeData]);
    const canBatchProcessAllTrainingSequences =
        !!selectedSeqId &&
        showDecomposed &&
        resolvedKnowledgeBaseButtons.every((actionButton) => savedKnowledgeBaseActionIds.includes(actionButton.id)) &&
        !isSavingStatusSequence &&
        !isSavingActionSequence &&
        !isSavingEntitySequence &&
        !isBatchProcessingAllSequences;
    const hasIntermediateSection = showSelectControl || showDetected;
    const showDualSectionHeader = !!singleSequenceSectionTitle || !!batchProcessingSectionTitle || !!batchProcessingButtonLabel;
    const activeStepId: FlowStepId = (() => {
        if (isExplaining || showAnomalyExplanation) return "explain";
        if (isDetecting || showDetected) return "detect";
        if (isDecomposing || showDecomposed) return "decompose";
        return "select";
    })();
    const baseFlowSteps: Array<{ id: FlowStepId; label: string; done: boolean; disabled: boolean }> = [
        { id: "select", label: selectStepLabel, done: !!selectedSeqId, disabled: false },
        { id: "decompose", label: decomposeStepLabel, done: showDecomposed, disabled: !selectedSeqId || isDecomposing },
        { id: "detect", label: "3 Detect and localize", done: showDetected, disabled: !selectedSeqId || !showDecomposed },
        { id: "explain", label: "4 Explain", done: hasExplainedAnomaly, disabled: !canExplain && !hasExplainedAnomaly },
    ];
    const flowSteps: Array<{ id: FlowStepId; label: string; done: boolean; disabled: boolean }> = baseFlowSteps.filter(
        (step) =>
            (!hideDetectAndExplainSteps || (step.id !== "detect" && step.id !== "explain")) &&
            (!hideSelectStep || step.id !== "select")
    );

    const unifiedLabelWidth = 248;
    const controlLabelStyle = {
        color: "var(--text-label)",
        fontSize: "var(--font-label)",
        fontWeight: 400,
        textAlign: "left" as const,
        whiteSpace: "nowrap" as const,
    };
    const detailRowStyle = {
        display: "grid",
        gridTemplateColumns: `${unifiedLabelWidth}px minmax(0, 1fr)`,
        alignItems: "baseline",
        columnGap: 12,
        minHeight: 30,
        width: "100%",
    };
    const detailLabelStyle = {
        margin: 0,
        color: "var(--text-label)",
        fontSize: "var(--font-label)",
        fontWeight: 400,
        textAlign: "left" as const,
        whiteSpace: "nowrap" as const,
    };
    const detailValueStyle = {
        margin: 0,
        fontSize: "var(--font-value)",
        fontWeight: 400,
        textAlign: "left" as const,
    };

    const openSelectControl = () => {
        setHoveredNode?.(null);
        resetKnowledgeBaseSequenceState();
        setShowSelectControl(true);
        setShowDecomposed(false);
        setShowDetected(false);
        resetDecomposingState();
        resetDetectingState();
        resetExplanationState();
        window.setTimeout(() => {
            sequenceSelectRef.current?.focus();
        }, 0);
    };

    const runDecompose = () => {
        if (!selectedSeqId) {
            openSelectControl();
            return;
        }
        if (!canDecompose) return;
        setHoveredNode?.(null);
        resetKnowledgeBaseSequenceState();
        setShowDecomposed(false);
        setShowDetected(false);
        resetDecomposingState();
        resetDetectingState();
        resetExplanationState();
        setIsDecomposing(true);
        decomposeTimerRef.current = window.setTimeout(() => {
            setIsDecomposing(false);
            setShowDecomposed(true);
            decomposeTimerRef.current = null;
        }, 900);
    };

    const runDetect = () => {
        if (!canDetect) return;
        setHoveredNode?.(null);
        setShowDetected(false);
        resetExplanationState();
        resetDetectingState();
        setIsDetecting(true);
        detectTimerRef.current = window.setTimeout(() => {
            setIsDetecting(false);
            setShowDetected(true);
            detectTimerRef.current = null;
        }, 900);
    };

    const runExplain = () => {
        if (!canExplain || isExplaining) return;
        resetExplanationState();
        setIsExplaining(true);
        explainTimerRef.current = window.setTimeout(() => {
            setIsExplaining(false);
            setHasExplainedAnomaly(true);
            setShowAnomalyExplanation(true);
            explainTimerRef.current = null;
        }, 900);
    };

    const jumpToAnomalyRow = () => {
        if (anomalyStartLine === null) return;
        setHoveredNode?.(null);
        const selector = `text[data-line-number="${anomalyStartLine}"]`;
        const target = svgRef.current?.querySelector(selector) as SVGGraphicsElement | null;
        if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
    };

    const waitForKnowledgeBaseAnimation = (ms: number) =>
        new Promise<void>((resolve) => {
            window.setTimeout(resolve, ms);
        });

    const runStatusSequenceKnowledgeBaseSave = useCallback(async () => {
        if (!canAddToKnowledgeBase || isSavingStatusSequence || !orderedActionSequences.length) return;
        const currentRunId = knowledgeBaseAnimationRunRef.current + 1;
        knowledgeBaseAnimationRunRef.current = currentRunId;
        setHoveredNode?.(null);
        setIsSavingStatusSequence(true);
        setSavedKnowledgeBaseActionIds((prev) => prev.filter((id) => id !== "status-seq"));
        setActiveKnowledgeBaseActionPath(null);
        setCompletedKnowledgeBaseActionPaths([]);
        setActiveKnowledgeBaseEntityPath(null);
        setCompletedKnowledgeBaseEntityPaths([]);

        for (const actionSequence of orderedActionSequences) {
            if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
            setActiveKnowledgeBaseActionPath(actionSequence.pathKey);
            const firstLineNumber = actionSequence.lineNumbers[0];
            if (typeof firstLineNumber === "number") {
                const rowTarget = svgRef.current?.querySelector(`text[data-line-number="${firstLineNumber}"]`) as SVGGraphicsElement | null;
                rowTarget?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
            }
            await waitForKnowledgeBaseAnimation(550);
            if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
            setCompletedKnowledgeBaseActionPaths((prev) =>
                prev.includes(actionSequence.pathKey) ? prev : [...prev, actionSequence.pathKey]
            );
            await waitForKnowledgeBaseAnimation(260);
        }

        if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
        setActiveKnowledgeBaseActionPath(null);
        setSavedKnowledgeBaseActionIds((prev) => (
            prev.includes("status-seq") ? prev : [...prev, "status-seq"]
        ));
        setIsSavingStatusSequence(false);
        setKbDialogMessage(
            `${orderedActionSequences.length} number of status-seqs of ${orderedActionSequences.length} actions, have been added to knowledge base as ground-truth!`
        );
    }, [canAddToKnowledgeBase, isSavingStatusSequence, orderedActionSequences, setHoveredNode]);

    const runActionSequenceKnowledgeBaseSave = useCallback(async () => {
        if (!canAddToKnowledgeBase || isSavingActionSequence || !orderedEntitySequences.length) return;
        const currentRunId = knowledgeBaseAnimationRunRef.current + 1;
        knowledgeBaseAnimationRunRef.current = currentRunId;
        setHoveredNode?.(null);
        setIsSavingActionSequence(true);
        setSavedKnowledgeBaseActionIds((prev) => prev.filter((id) => id !== "action-seq"));
        setActiveKnowledgeBaseActionPath(null);
        setActiveKnowledgeBaseEntityPath(null);
        setCompletedKnowledgeBaseEntityPaths([]);

        for (const entitySequence of orderedEntitySequences) {
            if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
            setActiveKnowledgeBaseEntityPath(entitySequence.pathKey);
            const firstLineNumber = entitySequence.lineNumbers[0];
            if (typeof firstLineNumber === "number") {
                const rowTarget = svgRef.current?.querySelector(`text[data-line-number="${firstLineNumber}"]`) as SVGGraphicsElement | null;
                rowTarget?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
            }
            await waitForKnowledgeBaseAnimation(550);
            if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
            setCompletedKnowledgeBaseEntityPaths((prev) =>
                prev.includes(entitySequence.pathKey) ? prev : [...prev, entitySequence.pathKey]
            );
            await waitForKnowledgeBaseAnimation(260);
        }

        if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
        setActiveKnowledgeBaseEntityPath(null);
        setSavedKnowledgeBaseActionIds((prev) => (
            prev.includes("action-seq") ? prev : [...prev, "action-seq"]
        ));
        setIsSavingActionSequence(false);
        setKbDialogMessage(
            `${orderedEntitySequences.length} number of action-seqs of ${orderedEntitySequences.length} entities, have been added to knowledge base as ground-truth!`
        );
    }, [canAddToKnowledgeBase, isSavingActionSequence, orderedEntitySequences, setHoveredNode]);

    const runEntitySequenceKnowledgeBaseSave = useCallback(async () => {
        if (!canAddToKnowledgeBase || isSavingEntitySequence || !treeData) return;
        const currentRunId = knowledgeBaseAnimationRunRef.current + 1;
        knowledgeBaseAnimationRunRef.current = currentRunId;
        setHoveredNode?.(null);
        setIsSavingEntitySequence(true);
        setSavedKnowledgeBaseActionIds((prev) => prev.filter((id) => id !== "entity-seq"));
        setActiveKnowledgeBaseActionPath(null);
        setActiveKnowledgeBaseEntityPath(null);
        setIsActiveKnowledgeBaseRoot(true);

        const firstLineNumber = collectOrderedActionSequences(treeData)[0]?.lineNumbers[0];
        if (typeof firstLineNumber === "number") {
            const rowTarget = svgRef.current?.querySelector(`text[data-line-number="${firstLineNumber}"]`) as SVGGraphicsElement | null;
            rowTarget?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }

        await waitForKnowledgeBaseAnimation(650);
        if (knowledgeBaseAnimationRunRef.current !== currentRunId) return;
        setIsActiveKnowledgeBaseRoot(false);
        setIsCompletedKnowledgeBaseRoot(true);
        setSavedKnowledgeBaseActionIds((prev) => (
            prev.includes("entity-seq") ? prev : [...prev, "entity-seq"]
        ));
        setIsSavingEntitySequence(false);
        setKbDialogMessage(
            "1 number of entity-seqs of 1 root node, have been added to knowledge base as ground-truth!"
        );
    }, [canAddToKnowledgeBase, isSavingEntitySequence, setHoveredNode, treeData]);

    const runBatchProcessAllTrainingSequences = useCallback(async () => {
        if (!canBatchProcessAllTrainingSequences) return;
        setIsBatchProcessingAllSequences(true);
        setBatchProcessingProgress(0);
        setBatchProcessingStepLabel("Storing status seq...");
        await waitForKnowledgeBaseAnimation(700);
        setBatchProcessingProgress(33);
        setBatchProcessingStepLabel("Storing action seq...");
        await waitForKnowledgeBaseAnimation(700);
        setBatchProcessingProgress(66);
        setBatchProcessingStepLabel("Storing entity seq...");
        await waitForKnowledgeBaseAnimation(700);
        setBatchProcessingProgress(100);
        setBatchProcessingStepLabel(null);
        setIsBatchProcessingAllSequences(false);
        setKbDialogMessage(
            `status seq: 49, action seq: 66, entity seq: 134 from ${resolvedTotalSequenceCount} log sequences are added to the knowledge base!`
        );
    }, [canBatchProcessAllTrainingSequences, resolvedTotalSequenceCount]);

    const showKnowledgeBaseToast = (message: string) => {
        setKbToastMessage(message);
        setKbToastVisible(true);
        if (kbToastHideTimerRef.current !== null) {
            window.clearTimeout(kbToastHideTimerRef.current);
        }
        if (kbToastRemoveTimerRef.current !== null) {
            window.clearTimeout(kbToastRemoveTimerRef.current);
        }
        kbToastHideTimerRef.current = window.setTimeout(() => {
            setKbToastVisible(false);
            kbToastHideTimerRef.current = null;
        }, 1800);
        kbToastRemoveTimerRef.current = window.setTimeout(() => {
            setKbToastMessage(null);
            kbToastRemoveTimerRef.current = null;
        }, 2200);
    };

    const dismissKnowledgeBaseToast = () => {
        if (kbToastHideTimerRef.current !== null) {
            window.clearTimeout(kbToastHideTimerRef.current);
            kbToastHideTimerRef.current = null;
        }
        if (kbToastRemoveTimerRef.current !== null) {
            window.clearTimeout(kbToastRemoveTimerRef.current);
        }
        setKbToastVisible(false);
        kbToastRemoveTimerRef.current = window.setTimeout(() => {
            setKbToastMessage(null);
            kbToastRemoveTimerRef.current = null;
        }, 180);
    };

    const dismissKnowledgeBaseDialog = () => {
        setKbDialogMessage(null);
    };

    const handleExplanationModalMouseMove = useCallback((event: MouseEvent) => {
        const offset = explanationDragOffsetRef.current;
        if (!offset) return;
        setExplanationModalPos({
            x: Math.max(12, event.clientX - offset.x),
            y: Math.max(80, event.clientY - offset.y),
        });
    }, []);

    const stopExplanationModalDrag = useCallback(() => {
        explanationDragOffsetRef.current = null;
        window.removeEventListener("mousemove", handleExplanationModalMouseMove);
        window.removeEventListener("mouseup", stopExplanationModalDrag);
    }, [handleExplanationModalMouseMove]);

    const startExplanationModalDrag = (event: React.MouseEvent<HTMLDivElement>) => {
        explanationDragOffsetRef.current = {
            x: event.clientX - explanationModalPos.x,
            y: event.clientY - explanationModalPos.y,
        };
        window.addEventListener("mousemove", handleExplanationModalMouseMove);
        window.addEventListener("mouseup", stopExplanationModalDrag);
    };

    const handleExplanationModalResizeMouseMove = useCallback((event: MouseEvent) => {
        const resize = explanationResizeRef.current;
        if (!resize) return;
        const maxWidth = Math.max(360, window.innerWidth - 24);
        const nextWidth = Math.min(maxWidth, Math.max(360, resize.startWidth + (event.clientX - resize.startX)));
        setExplanationModalWidth(nextWidth);
    }, []);

    const stopExplanationModalResize = useCallback(() => {
        explanationResizeRef.current = null;
        window.removeEventListener("mousemove", handleExplanationModalResizeMouseMove);
        window.removeEventListener("mouseup", stopExplanationModalResize);
    }, [handleExplanationModalResizeMouseMove]);

    const startExplanationModalResize = (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        explanationResizeRef.current = {
            startX: event.clientX,
            startWidth: explanationModalWidth,
        };
        window.addEventListener("mousemove", handleExplanationModalResizeMouseMove);
        window.addEventListener("mouseup", stopExplanationModalResize);
    };

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleExplanationModalMouseMove);
            window.removeEventListener("mouseup", stopExplanationModalDrag);
            window.removeEventListener("mousemove", handleExplanationModalResizeMouseMove);
            window.removeEventListener("mouseup", stopExplanationModalResize);
        };
    }, [
        handleExplanationModalMouseMove,
        stopExplanationModalDrag,
        handleExplanationModalResizeMouseMove,
        stopExplanationModalResize,
    ]);

    return (
        <div style={{ width: "100%", position: "relative" }}>
            <div className="sequence-tree h-max">
                {/* Nav Panel */ }
                <div 
                    style={{
                        position: "sticky",
                        top: 0,
                        background: "#fff",
                        zIndex: 10,
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
                                flexDirection: "column",
                                alignItems: "flex-start",
                                gap: 20,
                                padding: "30px 0 35px 0",
                                borderBottom: "1px solid #edf1f5",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, width: "100%" }}>
                                {topDescriptionText && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: "var(--font-sm)",
                                            color: "var(--text-label)",
                                            textAlign: "left",
                                        }}
                                    >
                                        {topDescriptionText}
                                    </p>
                                )}
                                {singleSequenceSectionTitle && (
                                    <div
                                        style={{
                                            fontSize: "var(--font-lg)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            textAlign: "left",
                                        }}
                                    >
                                        {singleSequenceSectionTitle}
                                    </div>
                                )}
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
                                    {flowSteps.map((step, idx) => {
                                    const isActive = step.id === activeStepId;
                                    const isDone = step.done;
                                    const isLoading =
                                        (step.id === "decompose" && isDecomposing) ||
                                        (step.id === "detect" && isDetecting) ||
                                        (step.id === "explain" && isExplaining);
                                    const isDisabled = step.disabled || isLoading;
                                        return (
                                            <React.Fragment key={step.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (step.id === "select") {
                                                            openSelectControl();
                                                            return;
                                                        }
                                                        if (step.id === "decompose") {
                                                            runDecompose();
                                                            return;
                                                        }
                                                        if (step.id === "detect") {
                                                            runDetect();
                                                            return;
                                                        }
                                                        runExplain();
                                                    }}
                                                    disabled={isDisabled}
                                                style={{
                                                    height: 30,
                                                    padding: "0 12px",
                                                    borderRadius: 999,
                                                    border: isDone ? "1px solid #bae6fd" : isActive ? "1px solid #fdba74" : "1px solid #d6d6d6",
                                                    background: isDone ? "#f0f9ff" : isActive ? "#fff7ed" : "#fff",
                                                    color: isDone ? "#0369a1" : isActive ? "#9a3412" : "#475569",
                                                    fontSize: "var(--font-sm)",
                                                    fontWeight: 400,
                                                    cursor: isDisabled ? "not-allowed" : "pointer",
                                                        opacity: isDisabled ? 0.55 : 1,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {isLoading ? (
                                                        <>
                                                            <Loader2 size={13} className="animate-spin" />
                                                            {step.id === "decompose"
                                                                ? "Decomposing..."
                                                                : step.id === "detect"
                                                                    ? "Detecting..."
                                                                    : "Explaining..."}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {isDone ? "✓" : ""}
                                                            {(step.id === "detect" || step.id === "explain") && <Sparkles size={12} />}
                                                            {step.label}
                                                        </>
                                                    )}
                                                </button>
                                                {idx < flowSteps.length - 1 && (
                                                    <span style={{ color: "#c7cdd4", fontSize: 13 }}>→</span>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                    {resolvedKnowledgeBaseButtons.map((actionButton) => {
                                    const isSaved = savedKnowledgeBaseActionIds.includes(actionButton.id);
                                    return (
                                        <React.Fragment key={actionButton.id}>
                                            <span style={{ color: "#c7cdd4", fontSize: 13 }}>→</span>
                                            <button
                                                type="button"
                                                disabled={!canAddToKnowledgeBase || isSavingStatusSequence || isSavingActionSequence || isSavingEntitySequence}
                                                onClick={() => {
                                                    if (!canAddToKnowledgeBase) return;
                                                    if (actionButton.id === "status-seq" && hideDetectAndExplainSteps) {
                                                        void runStatusSequenceKnowledgeBaseSave();
                                                        return;
                                                    }
                                                    if (actionButton.id === "action-seq" && hideDetectAndExplainSteps) {
                                                        void runActionSequenceKnowledgeBaseSave();
                                                        return;
                                                    }
                                                    if (actionButton.id === "entity-seq" && hideDetectAndExplainSteps) {
                                                        void runEntitySequenceKnowledgeBaseSave();
                                                        return;
                                                    }
                                                    if (hideDetectAndExplainSteps) return;
                                                    if (knowledgeBaseActionsInert) return;
                                                    setSavedKnowledgeBaseActionIds((prev) =>
                                                        prev.includes(actionButton.id) ? prev : [...prev, actionButton.id]
                                                    );
                                                    showKnowledgeBaseToast(
                                                        actionButton.toastMessage ?? `${actionButton.label} has been added to knowledge base!`
                                                    );
                                                }}
                                                style={{
                                                    height: 30,
                                                    padding: "0 12px",
                                                    borderRadius: 999,
                                                    border: isSaved ? "1px solid #bae6fd" : "1px solid #d6d6d6",
                                                    background: isSaved ? "#f0f9ff" : "#fff",
                                                    color: isSaved ? "#0369a1" : "#475569",
                                                    fontSize: "var(--font-sm)",
                                                    fontWeight: 400,
                                                    cursor: canAddToKnowledgeBase && !isSavingStatusSequence && !isSavingActionSequence && !isSavingEntitySequence ? "pointer" : "not-allowed",
                                                    opacity: canAddToKnowledgeBase && !isSavingStatusSequence && !isSavingActionSequence && !isSavingEntitySequence ? 1 : 0.55,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {actionButton.id === "status-seq" && isSavingStatusSequence ? (
                                                    <>
                                                        <Loader2 size={13} className="animate-spin" />
                                                        Saving status-seq...
                                                    </>
                                                ) : actionButton.id === "action-seq" && isSavingActionSequence ? (
                                                    <>
                                                        <Loader2 size={13} className="animate-spin" />
                                                        Saving action-seq...
                                                    </>
                                                ) : actionButton.id === "entity-seq" && isSavingEntitySequence ? (
                                                    <>
                                                        <Loader2 size={13} className="animate-spin" />
                                                        Saving entity-seq...
                                                    </>
                                                ) : (
                                                    <>{isSaved ? "✓ " : ""}{actionButton.label}</>
                                                )}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                                </div>
                            </div>
                            {showDualSectionHeader && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, width: "100%" }}>
                                    {batchProcessingSectionTitle && (
                                        <div
                                            style={{
                                                fontSize: "var(--font-lg)",
                                                fontWeight: 700,
                                                color: "var(--table-header-text)",
                                                textAlign: "left",
                                            }}
                                        >
                                            {batchProcessingSectionTitle}
                                        </div>
                                    )}
                                    {batchProcessingButtonLabel && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void runBatchProcessAllTrainingSequences();
                                                }}
                                                disabled={!canBatchProcessAllTrainingSequences}
                                                style={{
                                                    height: 32,
                                                    padding: "0 14px",
                                                    borderRadius: 999,
                                                    border: canBatchProcessAllTrainingSequences ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                                                    background: canBatchProcessAllTrainingSequences ? "#fff" : "#f8fafc",
                                                    color: canBatchProcessAllTrainingSequences ? "#334155" : "#94a3b8",
                                                    fontSize: "var(--font-sm)",
                                                    fontWeight: 400,
                                                    cursor: canBatchProcessAllTrainingSequences ? "pointer" : "not-allowed",
                                                    opacity: canBatchProcessAllTrainingSequences ? 1 : 0.7,
                                                    whiteSpace: "nowrap",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                }}
                                            >
                                                {isBatchProcessingAllSequences ? (
                                                    <>
                                                        <Loader2 size={13} className="animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    batchProcessingButtonLabel
                                                )}
                                            </button>
                                            {isBatchProcessingAllSequences && (
                                                <div
                                                    style={{
                                                        width: "min(520px, 100%)",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 8,
                                                        paddingTop: 2,
                                                    }}
                                                >
                                                    <div style={{ color: "#475569", fontSize: "var(--font-sm)" }}>
                                                        {batchProcessingStepLabel}
                                                    </div>
                                                    <div
                                                        style={{
                                                            width: "100%",
                                                            height: 10,
                                                            borderRadius: 999,
                                                            background: "#e2e8f0",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: `${batchProcessingProgress}%`,
                                                                height: "100%",
                                                                borderRadius: 999,
                                                                background: "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)",
                                                                transition: "width 240ms ease",
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {showSelectControl && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    flexWrap: "wrap",
                                    width: "100%",
                                    padding: "10px 0",
                                    borderBottom: "none",
                                }}
                            >
                                <div
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        marginBottom: 4,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                padding: "2px 10px",
                                                borderRadius: 999,
                                                border: "1px solid #fecaca",
                                                background: "#fef2f2",
                                                color: "#b91c1c",
                                                fontSize: "var(--font-sm)",
                                            }}
                                        >
                                            🚨 Abnormal: {abnormalSequenceCount}
                                        </span>
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                padding: "2px 10px",
                                                borderRadius: 999,
                                                border: "1px solid #bbf7d0",
                                                background: "#f0fdf4",
                                                color: "#166534",
                                                fontSize: "var(--font-sm)",
                                            }}
                                        >
                                            ✅ Normal: {resolvedTotalSequenceCount}
                                        </span>
                                        <span style={{ color: "var(--text-label)", fontSize: "var(--font-sm)" }}>
                                            Total: {resolvedTotalSequenceCount}
                                        </span>
                                    </div>
                                </div>
                                <label
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: `${unifiedLabelWidth}px minmax(0, 1fr)`,
                                        alignItems: "baseline",
                                        columnGap: 8,
                                        margin: 0,
                                    }}
                                >
                                    <span style={controlLabelStyle}>{selectControlLabel}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                        <select
                                            ref={sequenceSelectRef}
                                            value={selectedSeqId ?? ""}
                                            onChange={e => {
                                                if (!e.target.value) {
                                                    setHoveredNode?.(null);
                                                    setSavedKnowledgeBaseActionIds([]);
                                                    setShowDecomposed(false);
                                                    setShowDetected(false);
                                                    resetDecomposingState();
                                                    resetDetectingState();
                                                    resetExplanationState();
                                                    setSelectedIndex(null);
                                                    return;
                                                }
                                                setHoveredNode?.(null);
                                                setSavedKnowledgeBaseActionIds([]);
                                                setShowDecomposed(false);
                                                setShowDetected(false);
                                                resetDecomposingState();
                                                resetDetectingState();
                                                resetExplanationState();
                                                const idx = kroneDecompData.findIndex(row => row.seq_id === e.target.value);
                                                if (idx !== -1) setSelectedIndex(idx);
                                            }}
                                            style={{
                                                minWidth: 120,
                                                height: 30,
                                                border: "1px solid #ccc",
                                                color: "var(--text-value)",
                                                fontSize: "var(--font-sm)",
                                                textAlign: "left",
                                            }}
                                        >
                                            <option value=""></option>
                                            {sortedSequenceRows.map((row: KroneDecompRow) => (
                                                <option key={row.seq_id} value={row.seq_id}
                                                    style={{ color: abnormalSeqIdSet.has(row.seq_id) ? "#F00" : "#000" }}
                                                >
                                                    {abnormalSeqIdSet.has(row.seq_id) ? "🚨 Abnormal | " : "✅ Normal | "}
                                                    {row.seq_id}
                                                </option>
                                            ))}
                                        </select>
                                        {resolvedVisibleSequenceCount < resolvedTotalSequenceCount && (
                                            <span style={{ color: "#64748b", fontSize: "var(--font-sm)" }}>
                                                Showing first {resolvedVisibleSequenceCount} only
                                            </span>
                                        )}
                                    </div>
                                </label>
                            </div>
                        )}

                        {showDetected && (
                            <div style={{ width: "100%", paddingTop: 10, display: "grid", rowGap: 6 }}>
                            <div
                                style={{
                                    ...detailRowStyle,
                                    paddingTop: 6,
                                    borderTop: "1px solid #edf1f5",
                                    paddingBottom: 6,
                                    borderBottom: "1px solid #edf1f5",
                                }}
                            >
                                <h3 style={detailLabelStyle}>Sequence Prediction:</h3>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <h3
                                        style={{
                                            ...detailValueStyle,
                                            color: anomalyLevel === "Abnormal" ? "#F00" : anomalyLevel === "Normal" ? "#4caf50" : "#888",
                                        }}
                                    >
                                        {anomalyLevel}
                                    </h3>
                                    {anomalyLevelBadgeText && (
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                height: 24,
                                                padding: "0 10px",
                                                borderRadius: 999,
                                                border: "1px solid #fecaca",
                                                background: "#fef2f2",
                                                color: "#b91c1c",
                                                fontSize: "var(--font-sm)",
                                                fontWeight: 400,
                                                lineHeight: 1,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {anomalyLevelBadgeText}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {showDetected && anomalyLevel === "Abnormal" && anomalyLogKeysForSeq.length > 0 && (
                                <div style={detailRowStyle}>
                                    <h3 style={detailLabelStyle}>Abnormal Log Key Segment:</h3>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-start", textAlign: "left", width: "100%" }}>
                                        <h3
                                            style={{
                                                ...detailValueStyle,
                                                color: "#F00",
                                            }}
                                        >
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    jumpToAnomalyRow();
                                                }}
                                                style={{
                                                    display: "inline-block",
                                                    color: "#1a0dab",
                                                    textDecoration: "underline",
                                                    cursor: "pointer",
                                                    fontWeight: 400,
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {anomalySegmentLinkText}
                                            </a>
                                        </h3>
                                    </div>
                                </div>
                            )}
                            {showDetected && anomalyLevel === "Abnormal" && isExplaining && (
                                <div style={detailRowStyle}>
                                    <span></span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Loader2 size={16} className="animate-spin text-[#1f3f8f]" />
                                        <h3 style={{ ...detailValueStyle, color: "#1f3f8f" }}>
                                            LLM Thinking...
                                        </h3>
                                    </div>
                                </div>
                            )}
                            </div>
                        )}
                        <div
                            style={{
                                marginTop: hasIntermediateSection ? 10 : 0,
                                marginLeft: -20,
                                paddingTop: hasIntermediateSection ? 8 : 0,
                                paddingBottom: 6,
                                borderTop: hasIntermediateSection ? "1px solid #edf1f5" : "none",
                                position: "relative",
                                height: 40,
                                width: "100%",
                                minWidth: Math.max(columnHeaderPos.contentWidth, 420),
                                background: "var(--table-header-bg)",
                                borderBottom: "1px solid var(--table-header-border)",
                            }}
                        >
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.entityX,
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            display: showDecomposed ? "inline" : "none",
                                }}
                            >
                                Entity
                            </span>
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.actionX,
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            display: showDecomposed ? "inline" : "none",
                                }}
                            >
                                Action
                            </span>
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.statusX,
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            display: showDecomposed ? "inline" : "none",
                                }}
                            >
                                Status
                            </span>
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.indexX + columnHeaderPos.indexW / 2,
                                            transform: "translateX(-50%)",
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            whiteSpace: "nowrap",
                                }}
                            >
                                Index
                            </span>
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.logKeyX + columnHeaderPos.logKeyW / 2,
                                            transform: "translateX(-50%)",
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            whiteSpace: "nowrap",
                                }}
                            >
                                Log Key
                            </span>
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: columnHeaderPos.logTemplateX,
                                            fontSize: "var(--font-sm)",
                                            fontWeight: 700,
                                            color: "var(--table-header-text)",
                                            pointerEvents: "none",
                                            whiteSpace: "nowrap",
                                }}
                            >
                                Log Template
                            </span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                        <span className="animate-spin inline-block mr-2" style={{ fontSize: 24 }}>⏳</span>
                        Loading sequence tree...
                    </div>
                ) : (
                    <>
                        <svg ref={svgRef} />
                    </>
                )}
            </div>
            {showDetected && anomalyLevel === "Abnormal" && showAnomalyExplanation && (
                <div
                    role="dialog"
                    aria-label="Anomaly explanation dialog"
                    style={{
                        position: "fixed",
                        left: explanationModalPos.x,
                        top: explanationModalPos.y,
                        width: explanationModalWidth,
                        minWidth: 360,
                        maxWidth: "calc(100vw - 24px)",
                        background: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: 10,
                        boxShadow: "0 12px 28px rgba(0,0,0,0.16)",
                        zIndex: 1300,
                        overflow: "hidden",
                    }}
                >
                    <div
                        onMouseDown={startExplanationModalDrag}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "10px 12px",
                            borderBottom: "1px solid var(--table-header-border)",
                            background: "var(--table-header-bg)",
                            cursor: "move",
                            userSelect: "none",
                        }}
                    >
                        <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--table-header-text)" }}>
                            Anomaly Explanation (LLM)
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowAnomalyExplanation(false)}
                            aria-label="Close explanation dialog"
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#64748b",
                                fontSize: 18,
                                lineHeight: 1,
                                cursor: "pointer",
                                padding: 0,
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <div
                        style={{
                            padding: "12px 14px",
                            color: "var(--text-value)",
                            fontSize: "var(--font-sm)",
                            lineHeight: 1.5,
                            textAlign: "left",
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                            maxHeight: "40vh",
                            overflowY: "auto",
                        }}
                    >
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "140px minmax(0, 1fr)",
                                columnGap: 10,
                                alignItems: "start",
                                marginBottom: 10,
                                paddingBottom: 10,
                                borderBottom: "1px solid #edf1f5",
                            }}
                        >
                            <span style={{ color: "var(--text-label)", fontWeight: 600 }}>Log Key Segment</span>
                            <span>{anomalySegmentLinkText}</span>
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "140px minmax(0, 1fr)",
                                columnGap: 10,
                                alignItems: "start",
                                marginBottom: 10,
                                paddingBottom: 10,
                                borderBottom: "1px solid #edf1f5",
                            }}
                        >
                            <span style={{ color: "var(--text-label)", fontWeight: 600 }}>Level</span>
                            <span>{anomalyLevelText}</span>
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "140px minmax(0, 1fr)",
                                columnGap: 10,
                                alignItems: "start",
                                marginBottom: 12,
                                paddingBottom: 10,
                                borderBottom: "1px solid #edf1f5",
                            }}
                        >
                            <span style={{ color: "var(--text-label)", fontWeight: 600 }}>Parent Node</span>
                            <span>{anomalyParentNodeText}</span>
                        </div>
                        <div style={{ color: "var(--text-label)", fontWeight: 600, marginBottom: 8 }}>
                            LLM (ChatGPT-3.5) Explanation
                        </div>
                        <div>{anomalyExplanationText}</div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            padding: "10px 14px 12px 14px",
                            borderTop: "1px solid #edf1f5",
                            background: "#fff",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                if (knowledgeBaseActionsInert) return;
                                setSavedKnowledgeBaseActionIds((prev) =>
                                    prev.includes("default") ? prev : [...prev, "default"]
                                );
                                showKnowledgeBaseToast("abnormal segment has been added to knowledge base!");
                            }}
                            style={{
                                height: 30,
                                padding: "0 10px",
                                borderRadius: 8,
                                border: "1px solid #d6d6d6",
                                background: "#fff",
                                color: "#334155",
                                fontSize: "var(--font-sm)",
                                fontWeight: 400,
                                cursor: "pointer",
                            }}
                        >
                            {resolvedKnowledgeBaseButtons[0]?.label.replace(/^\d+\s*/, "") ?? "Save to knowledge base"}
                        </button>
                    </div>
                    <div
                        onMouseDown={startExplanationModalResize}
                        role="presentation"
                        style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: 12,
                            height: "100%",
                            cursor: "ew-resize",
                        }}
                    />
                </div>
            )}
            {kbDialogMessage && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Knowledge base save result"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 1400,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(15, 23, 42, 0.32)",
                        padding: 24,
                    }}
                >
                    <div
                        style={{
                            width: "min(560px, calc(100vw - 48px))",
                            background: "#fff",
                            border: "1px solid #dbe3ec",
                            borderRadius: 14,
                            boxShadow: "0 20px 48px rgba(15,23,42,0.22)",
                            overflow: "hidden",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: "14px 18px",
                                borderBottom: "1px solid var(--table-header-border)",
                                background: "var(--table-header-bg)",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: "inline-flex",
                                        width: 24,
                                        height: 24,
                                        borderRadius: 999,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "#16a34a",
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        flex: "0 0 auto",
                                    }}
                                >
                                    ✓
                                </span>
                                <span style={{ fontSize: "var(--font-sm)", fontWeight: 700, color: "var(--table-header-text)" }}>
                                    Added to Knowledge Base
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={dismissKnowledgeBaseDialog}
                                aria-label="Close result dialog"
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#64748b",
                                    fontSize: 20,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div
                            style={{
                                padding: "22px 20px 18px 20px",
                                color: "var(--text-value)",
                                fontSize: "var(--font-md)",
                                lineHeight: 1.55,
                                textAlign: "left",
                            }}
                        >
                            {kbDialogMessage}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                padding: "0 20px 18px 20px",
                            }}
                        >
                            <button
                                type="button"
                                onClick={dismissKnowledgeBaseDialog}
                                style={{
                                    height: 34,
                                    padding: "0 14px",
                                    borderRadius: 8,
                                    border: "1px solid #86efac",
                                    background: "#f0fdf4",
                                    color: "#166534",
                                    fontSize: "var(--font-sm)",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {kbToastMessage && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: "fixed",
                        right: 24,
                        bottom: 24,
                        zIndex: 1200,
                        background: "#0f172a",
                        color: "#fff",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                        padding: "10px 14px",
                        boxShadow: "0 8px 20px rgba(15,23,42,0.25)",
                        fontSize: "var(--font-sm)",
                        fontWeight: 400,
                        lineHeight: 1.3,
                        maxWidth: 420,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        opacity: kbToastVisible ? 1 : 0,
                        transform: kbToastVisible ? "translateY(0)" : "translateY(8px)",
                        transition: "opacity 180ms ease, transform 180ms ease",
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            display: "inline-flex",
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: "var(--font-xs)",
                            fontWeight: 700,
                            flex: "0 0 auto",
                        }}
                    >
                        ✓
                    </span>
                    <span style={{ flex: "1 1 auto" }}>{kbToastMessage}</span>
                    <button
                        type="button"
                        onClick={dismissKnowledgeBaseToast}
                        aria-label="Close notification"
                        style={{
                            border: "none",
                            background: "transparent",
                            color: "#cbd5e1",
                            cursor: "pointer",
                            fontSize: "var(--font-lg)",
                            lineHeight: 1,
                            padding: 0,
                            flex: "0 0 auto",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};
