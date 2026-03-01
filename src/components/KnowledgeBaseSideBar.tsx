import React, { useState, useEffect, useMemo } from "react";
import { X, Search, ChevronDown, Database, User, Activity, CircleDot } from "lucide-react";
import type { EntityDict, ActionDict, EntitySequences, Seq } from "@/pages/knowledge_base_viz";
import { exactSearch } from "@/pages/knowledge_base_viz";
import type { TreeNode } from "@/tree_utils";

// CONSTANTS
const ABNORMAL = "Abnormal";
const NORMAL = "Normal";
const ROOT_QUERY = "ROOT";
const NO_SUMMARY_MESSAGE = "No summary available";
const NO_SEQUENCES_MESSAGE = "No Sequences Available";
const LOGKEY_SEARCH_PLACEHOLDER = "Search logkey...";
const NODE_PREVIEW_COUNT = 8;

//TYPES
type SequenceUnitDisplayProps = {
    orderNum: number;
    seq: Seq;
    collapsible?: boolean;
    tableVariant?: "train" | "test";
    dataBadgeLabel?: string | null;
    selectedNodeInfo?: SelectedNodeInfo | null;
};

type SelectedNodeInfo = {
    entity: string;
    action?: string;
    status?: string;
    depth: number;
};

//Individual display of one sequence : Includes anomaly status, LLM description, prediction table, and approximate search option.
export function SequenceUnitDisplay({
    orderNum,
    seq,
    collapsible = true,
    tableVariant = "test",
    dataBadgeLabel = null,
    selectedNodeInfo = null,
}: SequenceUnitDisplayProps) {

    const [isAnomalyChecked, setIsAnomalyChecked] = useState<boolean>(seq.isAnomaly === true);
    const [isCollapsed, setCollapsibility] = useState<boolean>(true); 
    const [isNodeListExpanded, setIsNodeListExpanded] = useState<boolean>(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);
    const [isWhyExpanded, setIsWhyExpanded] = useState<boolean>(false);
    const [isExplanationExpanded, setIsExplanationExpanded] = useState<boolean>(false);
    const [pendingHumanLabel, setPendingHumanLabel] = useState<string>(NORMAL);
    const [humanOverride, setHumanOverride] = useState<string | null>(null);

    useEffect(() => {
        setIsAnomalyChecked(seq.isAnomaly === true);
        setIsNodeListExpanded(false);
        setIsSummaryExpanded(false);
        setIsWhyExpanded(false);
        setIsExplanationExpanded(false);
        setHumanOverride(null);
    }, [seq.isAnomaly, seq.arr]);
    const patternMatchingPrediction: string = "Unseen";
    const llmPrediction = isAnomalyChecked ? ABNORMAL : NORMAL;
    const autoPrediction = tableVariant === "train" ? NORMAL : llmPrediction;
    const finalPrediction = humanOverride ?? autoPrediction;
    const autoSourceText = autoPrediction === patternMatchingPrediction ? "PM" : "LLM";
    const finalSourceText = humanOverride ? "human" : autoSourceText;
    useEffect(() => {
        if (!humanOverride) setPendingHumanLabel(autoPrediction);
    }, [autoPrediction, humanOverride]);

    const showCollapsed = collapsible ? isCollapsed : false;
    const levelType = String(seq.seqType || "").toUpperCase();
    const levelLabel = levelType === "ENTITY" ? "Entity" : levelType === "ACTION" ? "Action" : levelType === "STATUS" ? "Status" : "Unknown";
    const levelPreviewLabel = levelLabel;
    const LevelIcon = levelType === "ENTITY" ? User : levelType === "ACTION" ? Activity : CircleDot;
    const resolvedDataBadgeLabel = dataBadgeLabel ?? (tableVariant === "train" ? "Training" : "Testing");
    const dataBadgeClass = resolvedDataBadgeLabel === "Training"
        ? "inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-900 font-semibold"
        : "inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border border-sky-300 bg-sky-100 text-sky-900 font-semibold";
    const levelBadgeClass = levelType === "ENTITY"
        ? "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border-2 border-rose-300 bg-rose-50 text-rose-800 font-medium"
        : levelType === "ACTION"
            ? "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border-2 border-violet-300 bg-violet-50 text-violet-800 font-medium"
            : levelType === "STATUS"
                ? "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border-2 border-emerald-300 bg-emerald-50 text-emerald-800 font-medium"
                : "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border-2 border-neutral-300 bg-neutral-50 text-neutral-700 font-medium";
    const highlightTarget = levelType === "ENTITY"
        ? selectedNodeInfo?.entity
        : levelType === "ACTION"
            ? selectedNodeInfo?.action
            : levelType === "STATUS"
                ? selectedNodeInfo?.status
                : undefined;
    const nodeClass = (value: string) => {
        const isHighlighted = !!highlightTarget && String(value).trim() === String(highlightTarget).trim();
        return isHighlighted
            ? "ui-text-sm text-[var(--text-value)] px-2 py-[2px] font-normal rounded-md border border-amber-500 bg-[#f7f7f7] ring-1 ring-amber-300 break-words whitespace-normal"
            : "ui-text-sm text-[var(--text-value)] px-2 py-[2px] font-normal rounded-md border border-[#d0d0d0] bg-[#f7f7f7] break-words whitespace-normal";
    };
    const compactNodes = useMemo(() => {
        const out: Array<{ value: string; count: number }> = [];
        for (const value of seq.arr) {
            const prev = out[out.length - 1];
            if (prev && prev.value === value) prev.count += 1;
            else out.push({ value, count: 1 });
        }
        return out;
    }, [seq.arr]);
    const hasHiddenNodes = compactNodes.length > NODE_PREVIEW_COUNT;
    const visibleCompactNodes = isNodeListExpanded ? compactNodes : compactNodes.slice(0, NODE_PREVIEW_COUNT);
    const unifiedLabelWidth = 186;
    const detailRowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: `${unifiedLabelWidth}px minmax(0, 1fr)`,
        alignItems: "baseline",
        columnGap: 6,
        minHeight: 30,
        width: "100%",
        paddingTop: 6,
        paddingBottom: 6,
        borderBottom: "1px solid #edf1f5",
    };
    const detailLabelStyle: React.CSSProperties = {
        margin: 0,
        color: "var(--text-label)",
        fontSize: "var(--font-label)",
        fontWeight: 400,
        textAlign: "left",
        whiteSpace: "nowrap",
    };
    const detailValueStyle: React.CSSProperties = {
        margin: 0,
        color: "var(--text-value)",
        fontSize: "var(--font-value)",
        fontWeight: 400,
        textAlign: "left",
    };

    return (
        <div style={{
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            borderRadius: 8,
            border: `1px solid ${finalPrediction === ABNORMAL ? "#fecaca" : "#edf1f5"}`,
            background: showCollapsed && finalPrediction === ABNORMAL ? "#fef2f2" : "#fff",
            padding: 12,
            fontSize: "var(--font-sm)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}>
            {/* Header Section w/ Collapse */}
            <div className="relative mb-2 flex items-start gap-2 pr-8">
                {!showCollapsed ?
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                        <span className={dataBadgeClass}>
                            <Database className="w-3.5 h-3.5" />
                            {resolvedDataBadgeLabel}
                        </span>
                        <span className={levelBadgeClass}>
                            <LevelIcon className="w-3.5 h-3.5" />
                            {levelLabel}
                        </span>
                    </div>
                    :
                    <div className="flex flex-1 items-center gap-2 flex-wrap">
                        <span className={dataBadgeClass}>
                            <Database className="w-3.5 h-3.5" />
                            {resolvedDataBadgeLabel}
                        </span>
                        <span className={levelBadgeClass}>
                            <LevelIcon className="w-3.5 h-3.5" />
                            {levelLabel}
                        </span>
                        <h1 className="flex flex-1 items-center gap-2 font-WPIfont text-left ui-text-sm font-bold">{`${orderNum}.`}
                            <span className={`text-neutral-800 px-1.5 py-0.5 font-medium rounded-sm border-2 break-words whitespace-normal ${nodeClass(seq.arr[0])}`}>{seq.arr[0]}</span>
                            
                            {seq.arr.length > 1 &&
                                <>
                                    {`➡➡`}
                                    <span className={`text-neutral-800 px-1.5 py-0.5 font-medium rounded-sm border-2 break-words whitespace-normal ${nodeClass(seq.arr[seq.arr.length-1])}`}>{seq.arr[seq.arr.length-1]}</span>
                                </>
                            }
                        </h1>
                    </div>
                }
                {collapsible && (
                    <button
                        type="button"
                        onClick={() => { setCollapsibility((prev) => !prev); }}
                        aria-label={showCollapsed ? "Expand card" : "Collapse card"}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-black transition-colors flex items-center justify-center"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${showCollapsed ? "rotate-0" : "rotate-180"}`} />
                    </button>
                )}
            </div>

            {!showCollapsed && <>
                <div style={{ width: "100%", borderTop: "1px solid #edf1f5", paddingTop: 4 }}>
                    <div style={detailRowStyle}>
                        <div style={detailLabelStyle}>{`${levelPreviewLabel} sequence preview:`}</div>
                        <div style={{ ...detailValueStyle, minWidth: 0 }}>
                            <div className="flex flex-wrap items-center gap-1">
                                {visibleCompactNodes.map((element, index) => (
                                    <React.Fragment key={index}>
                                        <span className={nodeClass(element.value)}>
                                            {element.value}
                                        </span>
                                        {element.count > 1 && (
                                            <span className="rounded-sm border border-neutral-400 px-1 py-[1px] ui-text-xs font-semibold text-neutral-700 bg-white">
                                                x{element.count}
                                            </span>
                                        )}
                                        {index < visibleCompactNodes.length - 1 && <span className="text-neutral-400">→</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                            {hasHiddenNodes && (
                                <div className="mt-1 flex items-center gap-2">
                                    {!isNodeListExpanded && <span className="ui-text-xs text-neutral-500">+{compactNodes.length - NODE_PREVIEW_COUNT} more</span>}
                                    <button
                                        type="button"
                                        className="ui-text-xs underline text-neutral-700 hover:text-black"
                                        onClick={() => setIsNodeListExpanded(prev => !prev)}
                                    >
                                        {isNodeListExpanded ? "Collapse sequence" : "Expand sequence"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={detailRowStyle}>
                        <div style={detailLabelStyle}>LLM Summary:</div>
                        <div style={{ ...detailValueStyle, minWidth: 0 }}>
                            <p className={`${isSummaryExpanded ? "" : "line-clamp-3"} text-neutral-700 leading-relaxed`}>
                                {seq.path_summary || NO_SUMMARY_MESSAGE}
                            </p>
                            {(seq.path_summary || "").length > 140 && (
                                <button
                                    type="button"
                                    onClick={() => setIsSummaryExpanded(prev => !prev)}
                                    className="mt-1 ui-text-xs underline text-neutral-700 hover:text-black"
                                >
                                    {isSummaryExpanded ? "Show less" : "Show more"}
                                </button>
                            )}
                        </div>
                    </div>

                    {tableVariant !== "train" && (
                        <>
                            <div style={detailRowStyle}>
                                <div style={detailLabelStyle}>Pattern matching detector:</div>
                                <div style={{ ...detailValueStyle, minWidth: 0 }}>
                                    <span className="text-amber-600 font-normal">
                                        Unseen
                                    </span>
                                </div>
                            </div>
                            <div style={detailRowStyle}>
                                <div style={detailLabelStyle}>LLM detector:</div>
                                <div style={{ ...detailValueStyle, minWidth: 0 }}>
                                    <span className={isAnomalyChecked ? "text-red-600 font-normal" : "text-emerald-700 font-normal"}>
                                        {isAnomalyChecked ? ABNORMAL : NORMAL}
                                    </span>
                                </div>
                            </div>
                            <div style={detailRowStyle}>
                                <div style={detailLabelStyle}>LLM explanation:</div>
                                <div style={{ ...detailValueStyle, minWidth: 0 }}>
                                    <button
                                        type="button"
                                        className="ui-text-xs underline text-neutral-700 hover:text-black"
                                        onClick={() => setIsExplanationExpanded(prev => !prev)}
                                    >
                                        {isExplanationExpanded ? "Collapse" : "Expand"}
                                    </button>
                                    {isExplanationExpanded && (
                                        <p className="mt-1 ui-text-sm text-neutral-700">
                                            {seq.explanation || NO_SUMMARY_MESSAGE}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <div style={detailRowStyle}>
                        <div style={detailLabelStyle}>Final label:</div>
                        <div style={{ ...detailValueStyle, minWidth: 0 }}>
                            <div className="flex items-center gap-2">
                                {tableVariant === "train" ? (
                                    <span className="font-semibold text-emerald-700">{NORMAL} (GT)</span>
                                ) : (
                                    <span className={`font-semibold ${finalPrediction === ABNORMAL ? "text-red-700" : "text-emerald-700"}`}>
                                        {finalPrediction}
                                    </span>
                                )}
                                {tableVariant !== "train" && (
                                    <>
                                        <span className="ui-text-xs text-neutral-500">({finalSourceText})</span>
                                        <button
                                            type="button"
                                            className="ui-text-xs underline text-neutral-700 hover:text-black"
                                            onClick={() => setIsWhyExpanded(prev => !prev)}
                                        >
                                            Why? {isWhyExpanded ? "▴" : "▾"}
                                        </button>
                                    </>
                                )}
                            </div>
                            {tableVariant !== "train" && isWhyExpanded && (
                                <p className="mt-1 ui-text-xs text-neutral-600">
                                    Auto labels are derived from aggregated detector outputs, where LLM-based detector predictions are prioritized. When applied, human overrides take precedence over all automated decisions.
                                </p>
                            )}
                        </div>
                    </div>

                    <div style={{ ...detailRowStyle, borderBottom: "none" }}>
                        <div style={detailLabelStyle}>Human override:</div>
                        <div style={{ ...detailValueStyle, minWidth: 0 }} className="flex flex-wrap items-center gap-2">
                            <span className="ui-text-xs text-neutral-700">Change label:</span>
                            <select
                                className="min-w-[110px] rounded-md border border-neutral-300 bg-white px-2 py-1"
                                value={pendingHumanLabel}
                                onChange={(e) => setPendingHumanLabel(e.target.value)}
                            >
                                <option value={ABNORMAL}>{ABNORMAL}</option>
                                <option value={NORMAL}>{NORMAL}</option>
                            </select>
                            <button
                                type="button"
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 ui-text-xs hover:bg-neutral-50"
                                onClick={() => setHumanOverride(pendingHumanLabel)}
                            >
                                Apply
                            </button>
                            <button
                                type="button"
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 ui-text-xs hover:bg-neutral-50 disabled:opacity-50"
                                onClick={() => {
                                    setHumanOverride(null);
                                    setPendingHumanLabel(autoPrediction);
                                }}
                                disabled={!humanOverride}
                            >
                                Revert to auto
                            </button>
                        </div>
                    </div>

                </div>
            </>}
        </div>
    );
}

type SequenceScrollableProps = {
    sequences: Seq[];
    tableVariant?: "train" | "test";
    dataBadgeLabel?: string | null;
    getTableVariant?: (seq: Seq) => "train" | "test";
    getDataBadgeLabel?: (seq: Seq) => string | null;
    selectedNodeInfo?: SelectedNodeInfo | null;
};

/* Returns scrollable composed of multiple sequence units */
function SequenceScrollable({
    sequences,
    tableVariant = "test",
    dataBadgeLabel = null,
    getTableVariant,
    getDataBadgeLabel,
    selectedNodeInfo = null,
}: SequenceScrollableProps) {
    const infoNodeClass = (isHighlighted: boolean) =>
        `inline-block ui-text-sm text-[var(--text-value)] px-2 py-[2px] font-normal rounded-md border break-words whitespace-normal ${
            isHighlighted
                ? "border-[#60a5fa] bg-[#dbeafe]"
                : "border-[#d0d0d0] bg-[#f7f7f7]"
        }`;
    const unifiedLabelWidth = 186;
    const panelRowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: `${unifiedLabelWidth}px minmax(0, 1fr)`,
        alignItems: "baseline",
        columnGap: 6,
        minHeight: 30,
        width: "100%",
        paddingTop: 6,
        paddingBottom: 6,
        borderBottom: "1px solid #edf1f5",
    };
    const panelLabelStyle: React.CSSProperties = {
        margin: 0,
        color: "var(--text-label)",
        fontSize: "var(--font-label)",
        fontWeight: 700,
        textAlign: "left",
        whiteSpace: "nowrap",
    };

    if (!sequences || sequences.length === 0) {
        return (
            <div style={{ display: "flex", justifyContent: "center", border: "1px solid #edf1f5", borderTop: "none", padding: 16 }}>
                <span className="italic text-neutral-500">{NO_SEQUENCES_MESSAGE}</span>
            </div>
        );
    }
    return (
        <div style={{ maxHeight: "70vh", overflowY: "auto", border: "1px solid #edf1f5", borderTop: "none", background: "#f9fafb", padding: 16 }}>
            {selectedNodeInfo && (
                <div style={{ marginBottom: 16, borderRadius: 8, border: "1px solid #edf1f5", background: "#fff", padding: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <h3 style={{ margin: "0 0 8px 0", color: "var(--text-label)", fontSize: "var(--font-md)", fontWeight: 700 }}>Node information</h3>
                    <div style={panelRowStyle}>
                        <div style={panelLabelStyle}>Entity</div>
                        <div style={{ textAlign: "left" }}>
                            <span className={infoNodeClass(selectedNodeInfo.depth === 1)}>{selectedNodeInfo.entity || "-"}</span>
                        </div>
                    </div>
                    {selectedNodeInfo.depth >= 2 && (
                        <div style={panelRowStyle}>
                            <div style={panelLabelStyle}>Action</div>
                            <div style={{ textAlign: "left" }}>
                                <span className={infoNodeClass(selectedNodeInfo.depth === 2)}>{selectedNodeInfo.action || "-"}</span>
                            </div>
                        </div>
                    )}
                    {selectedNodeInfo.depth >= 3 && (
                        <div style={{ ...panelRowStyle, borderBottom: "none" }}>
                            <div style={panelLabelStyle}>Status</div>
                            <div style={{ textAlign: "left" }}>
                                <span className={infoNodeClass(selectedNodeInfo.depth === 3)}>{selectedNodeInfo.status || "-"}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {sequences.slice(0, 1000).map((element, index) => {
                const resolvedVariant = getTableVariant ? getTableVariant(element) : tableVariant;
                const resolvedBadge = getDataBadgeLabel ? getDataBadgeLabel(element) : dataBadgeLabel;
                return (
                    <div key={index} className="scroll-mt-4">
                        <SequenceUnitDisplay 
                            orderNum={index+1}
                            seq={element}
                            tableVariant={resolvedVariant}
                            dataBadgeLabel={resolvedBadge}
                            selectedNodeInfo={selectedNodeInfo}
                        />
                    </div>
                );
            })}
        </div>
    );
}


type KnowledgeBaseSideBarProps = {
    showSidebar: boolean;
    toggleSidebar: () => void;
    trainingData: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences };
    testingData: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences };
    allSequences: Seq[];
    query: string;
    initialSearchLogKey?: string;
    defaultTab?: "train" | "test" | "approx";
    treeData: TreeNode | null;
};

// -- KnowledgeBaseSideBar Component -- Takes in knowledge structure data, an inital query search, and a togglesidebar state
// Alternate showSidebar from t/f to hide and display sidebar, change search query for different children
export const KnowledgeBaseSideBar: React.FC<KnowledgeBaseSideBarProps> = ({
    showSidebar,
    toggleSidebar,
    trainingData,
    testingData,
    allSequences,
    query,
    initialSearchLogKey = "",
    defaultTab = "train",
    treeData = null,
}) => {
    void defaultTab;
    const [searchLogKey, setSearchLogKey] = useState<string>("");
    const [currentDataDisplay, setCurrentDataDisplay] = useState<Seq[]>([]);

    const levelRank: Record<string, number> = { ENTITY: 0, ACTION: 1, STATUS: 2 };
    const getSelectedNodeInfo = (tree: TreeNode | null, targetName: string): SelectedNodeInfo | null => {
        if (!tree || !targetName || targetName === ROOT_QUERY) return null;
        type PathEntry = { node: TreeNode; depth: number };
        const foundPath: PathEntry[] = [];
        const dfs = (node: TreeNode, path: PathEntry[]): boolean => {
            const nextPath = [...path, { node, depth: path.length }];
            if (node.name === targetName) {
                foundPath.push(...nextPath);
                return true;
            }
            for (const child of node.children || []) {
                if (dfs(child, nextPath)) return true;
            }
            return false;
        };
        if (!dfs(tree, [])) return null;
        const getNameAtDepth = (depth: number) => foundPath.find(p => p.depth === depth)?.node.name;
        const depth = foundPath[foundPath.length - 1]?.depth ?? 0;
        return {
            entity: getNameAtDepth(1) || "-",
            action: getNameAtDepth(2),
            status: getNameAtDepth(3),
            depth,
        };
    };
    const gatherAllFromData = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }): Seq[] => {
        const collected = new Set<Seq>();
        data.entitySequences.forEach(seq => collected.add(seq));
        Object.values(data.entityDict).forEach(list => list.forEach(seq => collected.add(seq)));
        Object.values(data.actionDict).forEach(list => list.forEach(seq => collected.add(seq)));
        return Array.from(collected);
    };
    const trainingSeqSet = useMemo(() => new Set<Seq>(gatherAllFromData(trainingData)), [trainingData]);
    const testingSeqSet = useMemo(() => new Set<Seq>(gatherAllFromData(testingData)), [testingData]);
    const sortCombinedSequences = (sequences: Seq[]) => {
        return [...sequences].sort((a, b) => {
            const aSourceRank = trainingSeqSet.has(a) ? 0 : testingSeqSet.has(a) ? 1 : 2;
            const bSourceRank = trainingSeqSet.has(b) ? 0 : testingSeqSet.has(b) ? 1 : 2;
            if (aSourceRank !== bSourceRank) return aSourceRank - bSourceRank;
            const aLevelRank = levelRank[String(a.seqType || "").toUpperCase()] ?? 99;
            const bLevelRank = levelRank[String(b.seqType || "").toUpperCase()] ?? 99;
            if (aLevelRank !== bLevelRank) return aLevelRank - bLevelRank;
            return Number(a.isAnomaly) - Number(b.isAnomaly);
        });
    };
    const getSeq = (data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences }) => {
        const { entityDict, actionDict, entitySequences } = data;
        if (query === ROOT_QUERY) return entitySequences;
        if (entityDict[query]) return entityDict[query];
        if (actionDict[query]) return actionDict[query];
        return [];
    };
    const combineAndSort = (trainSeqs: Seq[], testSeqs: Seq[]) => sortCombinedSequences([...trainSeqs, ...testSeqs]);
    const resolveRowTableVariant = (seq: Seq): "train" | "test" => (trainingSeqSet.has(seq) ? "train" : "test");
    const resolveRowDataBadge = (seq: Seq): string | null => (trainingSeqSet.has(seq) ? "Training" : testingSeqSet.has(seq) ? "Testing" : null);
    const selectedNodeInfo = useMemo(() => getSelectedNodeInfo(treeData, query), [treeData, query]);

    // When the component mounts set the current training and testing displays based off query
    useEffect(() => {
        if (initialSearchLogKey) return; // Don't overwrite if searching by logkeys
        setCurrentDataDisplay(combineAndSort(getSeq(trainingData), getSeq(testingData)));
    }, [trainingData, testingData, query, initialSearchLogKey, trainingSeqSet, testingSeqSet]);

    useEffect(() => {
        if (!showSidebar) {
            setSearchLogKey("");
        }
    }, [showSidebar]);

    useEffect(() => {
        if (showSidebar && initialSearchLogKey) {
            setSearchLogKey(initialSearchLogKey);
            const keys = initialSearchLogKey.split(",").map((k) => k.trim());
            const results = exactSearch(allSequences, keys);
            setCurrentDataDisplay(sortCombinedSequences(results));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSidebar, initialSearchLogKey]);

    // On successful search update the current training and testing display
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchLogKey.trim()) {
            setCurrentDataDisplay(combineAndSort(getSeq(trainingData), getSeq(testingData)));
        } else {
            const keys = searchLogKey.split(",").map((k) => k.trim());
            const results = exactSearch(allSequences, keys);
            setCurrentDataDisplay(sortCombinedSequences(results));
        }
    };

    if (!showSidebar) return null;

    return (
        <div className="fixed right-0 top-[4.75rem] h-[calc(100vh-4.75rem)] w-[36%] bg-white text-black rounded-l-lg border-l border-y border-[#edf1f5] shadow-[0_2px_8px_rgba(0,0,0,0.04)] z-40 animate-slide-in-right-fast">
            { /* -- TITLE DISPLAY W/ CLOSEOUT */}
            <div className="p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold font-WPIfont">Knowledge Base</h2>
                <button onClick={toggleSidebar} className="text-neutral-400 hover:text-black hover:scale-110">
                    <X />
                </button>
            </div>

            { /* EXACT LOGKEY SEARCH */}
            <form className="p-4 flex items-center justify-center border border-[#edf1f5] border-b-0" onSubmit={handleSearchSubmit}>
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder={LOGKEY_SEARCH_PLACEHOLDER}
                        value={searchLogKey}
                        onChange={(e) => setSearchLogKey(e.target.value)}
                        className="w-full p-2 pr-10 bg-white border-4 border-WPIGrey rounded-md placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    />
                    <button type="submit" className="absolute top-1/2 right-3 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-neutral-400 hover:text-black hover:scale-110" />
                    </button>
                </div>
            </form>

            <SequenceScrollable
                sequences={currentDataDisplay}
                getTableVariant={resolveRowTableVariant}
                getDataBadgeLabel={resolveRowDataBadge}
                selectedNodeInfo={selectedNodeInfo}
            />
        </div>
    );
};
