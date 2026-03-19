import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { Footer } from "@/components/footer";
import { SequenceTree } from "@/components/sequence_tree";
import { TreeInfoPanel } from "@/components/viz_tree_components/info_panel/tree_info_panel";
import type { HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "@/tree_utils";
import { SmallViewportWarning } from "@/components/smallViewportWarning";
import { X } from "lucide-react";
import { withBase } from "@/lib/base-url";


// Data type for visualizing new tree
export type KroneDecompRow = {
    seq_id: string;
    seq: string[];
    entity_nodes_for_logkeys: string[];
    action_nodes_for_logkeys: string[];
    status_nodes_for_logkeys: string[];
};

export type KroneDetectRow = {
    seq_id: string;
    seq: string[];
    anomaly_seg: string[];
    anomaly_level: "entity" | "action" | "status";
    anomaly_reason: string;
};

type VisualizeTableProps = {
    decomposeDataPath?: string;
    sequenceTreeProps?: {
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
        dynamicStepDescriptions?: {
            initial?: string;
            afterSelect?: string;
            afterDecompose?: string;
            afterDetect?: string;
            afterExplain?: string;
            afterStatusSave?: string;
            afterActionSave?: string;
            afterEntitySave?: string;
        };
    };
};

const SEQUENCE_DROPDOWN_LIMIT = 1000;

// Utility function to parse arrays from CSV strings
const parseArray = (str: string): string[] => {
    if (!str) return [];
    try {
        return str
            .replace(/[[\]'""]/g, "") // Remove brackets and quotes
            .split(",") // Split by commas
            .map((s) => s.trim()) // Trim whitespace
            .filter(Boolean); // Remove empty strings
    } catch {
        return [];
    }
};

// Utility function to fetch and parse Krone Decompose data
const fetchKroneDecompData = async (filePath: string): Promise<{
    rows: KroneDecompRow[];
    totalCount: number;
    visibleCount: number;
}> => {
    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Failed to fetch Krone Decompose data");
        return { rows: [], totalCount: 0, visibleCount: 0 };
    }

    const csvText = await response.text();
    let parsedRows: KroneDecompRow[] = [];
    let totalCount = 0;

    Papa.parse<KroneDecompRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const rows: KroneDecompRow[] = results.data.map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return {
                    seq_id: String(r.seq_id ?? ""),
                    seq: parseArray(String(r.seq ?? "")),
                    entity_nodes_for_logkeys: parseArray(String(r.entity_nodes_for_logkeys ?? "")),
                    action_nodes_for_logkeys: parseArray(String(r.action_nodes_for_logkeys ?? "")),
                    status_nodes_for_logkeys: parseArray(String(r.status_nodes_for_logkeys ?? "")),
                };
            });
            totalCount = rows.length;
            parsedRows = rows.slice(0, SEQUENCE_DROPDOWN_LIMIT);
        },
    });

    return {
        rows: parsedRows,
        totalCount,
        visibleCount: Math.min(totalCount, SEQUENCE_DROPDOWN_LIMIT),
    };
};

// Utility function to fetch and parse Krone Detection data
const fetchKroneDetectData = async (filePath: string): Promise<KroneDetectRow[]> => {
    const response = await fetch(filePath);
    if (!response.ok) {
        console.error("Failed to fetch Krone Detection data");
        return [];
    }

    const csvText = await response.text();
    const parsedData: KroneDetectRow[] = [];

    Papa.parse<KroneDetectRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            const rows: KroneDetectRow[] = results.data.map((row: unknown) => {
                const r = row as Record<string, unknown>;
                return {
                    seq_id: String(r.seq_id ?? ""),
                    seq: parseArray(String(r.seq ?? "")),
                    anomaly_seg: parseArray(String(r.anomaly_seg ?? "")),
                    anomaly_level: r.anomaly_level as "entity" | "action" | "status",
                    anomaly_reason: String(r.anomaly_reason ?? ""),
                };
            });
            parsedData.push(...rows);
        },
    });

    return parsedData;
};

// Main Component
export const VisualizeTable: React.FC<VisualizeTableProps> = ({
    decomposeDataPath = "krone_decompose_res.csv",
    sequenceTreeProps,
}) => {
    const [kroneDecompData, setKroneDecompData] = useState<KroneDecompRow[]>([]);
    const [totalSequenceCount, setTotalSequenceCount] = useState(0);
    const [visibleSequenceCount, setVisibleSequenceCount] = useState(0);
    const [kroneDetectData, setKroneDetectData] = useState<KroneDetectRow[]>([]);
    const [hoveredNode, setHoveredNode] = useState<HierarchyNode<TreeNode> | null>(null);
    const [showInfoSidebar, setShowInfoSidebar] = useState(false);
    const [multiLineAnomaly, setMultiLineAnomaly] = useState(false);


    useEffect(() => {
        fetchKroneDecompData(withBase(decomposeDataPath)).then((data) => {
            setKroneDecompData(data.rows);
            setTotalSequenceCount(data.totalCount);
            setVisibleSequenceCount(data.visibleCount);
        });

        fetchKroneDetectData(withBase("krone_detection_res.csv")).then((data) => {
            setKroneDetectData(data);
        });
    }, [decomposeDataPath]);

    const handleNodeSelect = useCallback((node: HierarchyNode<TreeNode> | null) => {
        setHoveredNode(node);
        setShowInfoSidebar(!!node);
    }, []);

    return (
        <div
            style={{
                minHeight: "100vh",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <div className="lg:hidden pt-[4.5rem]"></div>
            <SmallViewportWarning />
            <div className="hidden lg:flex"
                style={{
                    flex: "1 1 auto",
                    alignItems: "flex-start",
                    paddingTop: "80px",
                    paddingLeft: "20px",
                    paddingRight: "20px",
                    boxSizing: "border-box",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "calc(100% - 24px)",
                        overflowX: "scroll",
                        overflowY: "auto",
                        marginTop: 24,
                        boxSizing: "border-box",
                        position: "relative",
                    }}
                >
                    <div style={{ minWidth: 1600 }}>
                        <SequenceTree
                            kroneDecompData={kroneDecompData}
                            totalSequenceCount={totalSequenceCount}
                            visibleSequenceCount={visibleSequenceCount}
                            kroneDetectData={kroneDetectData}
                            setHoveredNode={handleNodeSelect}
                            setMultiLineAnomaly={setMultiLineAnomaly}
                            multiLineAnomaly={multiLineAnomaly}
                            topDescriptionText={
                                sequenceTreeProps?.topDescriptionText ??
                                (decomposeDataPath === "krone_decompose_res.csv"
                                    ? "Explore how krone hierarchically detects a test log sequence"
                                    : undefined)
                            }
                            {...sequenceTreeProps}
                        />
                    </div>
                </div>
            </div>
            {showInfoSidebar && (
                <div className="fixed right-0 top-[4.75rem] h-[calc(100vh-4.75rem)] w-2/5 bg-white text-black rounded-l-lg border-l border-y border-[#edf1f5] shadow-[0_2px_8px_rgba(0,0,0,0.04)] z-40 animate-slide-in-right-fast">
                    <div className="p-4 flex justify-between items-center border-b border-[#edf1f5]">
                        <h2 className="text-xl font-bold font-WPIfont">Node Information</h2>
                        <button
                            onClick={() => {
                                setShowInfoSidebar(false);
                                setHoveredNode(null);
                            }}
                            className="text-neutral-400 hover:text-black hover:scale-110"
                            aria-label="Close node information sidebar"
                        >
                            <X />
                        </button>
                    </div>
                    <div className="h-[calc(100%-64px)] max-h-[calc(100vh-8.75rem)] overflow-y-auto border border-[#edf1f5] border-t-0 bg-neutral-50 p-4 rounded-b-lg">
                        <TreeInfoPanel node={hoveredNode} multiLineAnomaly={multiLineAnomaly} isSequencePanel={true} />
                    </div>
                </div>
            )}
            <div className="w-full fixed bottom-0">
                <Footer />
            </div>
        </div>
    );
};
