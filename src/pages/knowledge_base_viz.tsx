import { Footer } from "@/components/footer";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { KnowledgeBaseSideBar } from "@/components/KnowledgeBaseSideBar";
import { VizTree } from "@/components/viz_tree_components/viz_tree/viz_tree";
import { buildTree } from "@/tree_utils";
import type { TreeNode } from "@/tree_utils";
import { SmallViewportWarning } from "@/components/smallViewportWarning";
import { useDataset } from "@/DatasetContext";
import { DatasetChip } from "@/components/dataset_selector";
import { StageHeader } from "@/components/stage_header";
import { useStageComplete } from "@/components/next_stage";
import { useKnowledgeBaseAdditions } from "@/KnowledgeBaseAdditions";
import type { KroneSeqAddition } from "@/KnowledgeBaseAdditions";

//CONSTANTS
const KNOWLEDGE_BASE_DESC = "Explore the knowledge base by interacting with the visualization below. Click on a node to query its child Krone-seqs."
const ROOT_QUERY = "Root";

//TYPES
export type KnowledgeBaseData = {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
};

export type Seq = {
    arr: string[];
    explanation: string;
    seqType: string;
    isAnomaly: boolean;
    logkey_seq: string[];
    embedding: number[];
    path_summary?: string; // Added path_summary field
};

export type EntityDict = Record<string, Seq[]>;
export type ActionDict = Record<string, Seq[]>;
export type EntitySequences = Seq[];
export type DataScope = "all" | "train" | "test";

export type CSVRow = {
    path_layer?: string;
    entity_identifier?: string;
    action_identifier?: string;
    status_identifier?: string;
    logkey_seq?: string;
    path_reason?: string;
    pattern_embedding?: string;
    path_summary?: string; // Added path_summary field
    path_pred?: string; // Added path_pred field for isAnomaly
};

type SequenceCount = {
    normal: number;
    abnormal: number;
};

type SequenceStatsLookup = Record<string, SequenceCount>;

function useQuery() {
  return new URLSearchParams(window.location.search);
}

// --parseListField-- Parse individual string and return it as list
function parseListField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * logkey_seq is the one column that arrives bracketed -- "[11, 11, 1, 1]" --
 * while the identifier columns do not ("none_38,none_40"). Splitting it on
 * commas alone left the brackets glued to the end tokens, so the stored
 * sequence was ["[11", "11", "1", "1]"] and could never equal anything a
 * search produced: typing 11,11,1,1 in the sidebar matched nothing, and
 * neither did the log keys handed over from the detection page, which strip
 * brackets when it parses the same numbers.
 */
export function parseLogKeySeqField(field: string): string[] {
    if (!field || field.trim() === "") return [];
    return field
        .replace(/[[\]'"]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

// -- parseEmbeddingField function -- Parses embedding field of csv file and returns them as array of number 
function parseEmbeddingField(field: string): number[] {
    if (!field || field.trim() === "") return [];

    try {
        const parsed = JSON.parse(field);

        // Flatten in case it's [[...]] instead of [...]
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            return parsed.flat(); // or parsed[0] if it's always one row
        }

        return parsed.map((n: number) => n); // assume flat
    } catch {
        console.error("Failed to parse embedding field:", field);
        return [];
    }
}

// -- buildKnowledgeStructures function -- Takes array of CSVRow's and constructs an Entity Dictionary which takes an
// entity query and returns the list of sequence children, an actionDict that does the same for actions, and a list
// of allSequences and entitySequences
export function buildKnowledgeStructures(rows: CSVRow[]): {
    entityDict: EntityDict;
    actionDict: ActionDict;
    entitySequences: EntitySequences;
    allSequences: Seq[];
} {
    const entityDict: EntityDict = {};
    const actionDict: ActionDict = {};
    const entitySequences: EntitySequences = [];
    const allSequences: Seq[] = [];

    for (const row of rows) {
        const path_layer = row.path_layer?.trim().toUpperCase();
        const entity_id = row.entity_identifier?.trim();
        const action_id = row.action_identifier?.trim();
        const status_id = row.status_identifier?.trim();
        const logkey_seq = parseLogKeySeqField(row.logkey_seq || "");
        const explanation = row.path_reason || "";
        const seqType = path_layer || "";

        // Parse path_pred column as isAnomaly
        const isAnomaly = row.path_pred !== undefined ? row.path_pred === "1" : false;

        //Find embedding from test_embedding_all_csv
        const embedding = parseEmbeddingField(row.pattern_embedding || "");

        const path_summary = row.path_summary || ""; // Extract path_summary

        const seq: Seq = { arr: [], explanation, seqType, isAnomaly, logkey_seq, embedding, path_summary };

        if (path_layer === "STATUS") {
            const statusSeq = parseListField(status_id || "");
            seq.arr = statusSeq;
            allSequences.push(seq);
            if (action_id) {
                if (!actionDict[action_id]) actionDict[action_id] = [];
                actionDict[action_id].push(seq);
            }
        } else if (path_layer === "ACTION") {
            const actionSeq = parseListField(action_id || "");
            seq.arr = actionSeq;
            allSequences.push(seq);
            if (entity_id) {
                if (!entityDict[entity_id]) entityDict[entity_id] = [];
                entityDict[entity_id].push(seq);
            }
        } else if (path_layer === "ENTITY") {
            const entitySeq = parseListField(entity_id || "");
            seq.arr = entitySeq;
            entitySequences.push(seq);
            allSequences.push(seq);
        }
    }

    return { entityDict, actionDict, entitySequences, allSequences };
}

// -- parseKnowledgeCSV Function -- Parses knowledge base csv and returns callback with build knowledge structures
export function parseKnowledgeCSV(
    csvText: string,
    callback: (structures: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences; allSequences: Seq[] }) => void
) {
    Papa.parse<CSVRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            try {
                const structures = buildKnowledgeStructures(results.data);
                callback(structures);
            } catch (error) {
                console.error("Error building knowledge structures:", error);
            }
        },
    });
}

//Cosine Similarity Calculation Function
function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
}

// Approximate search for top k closest sequences using cosine similarity
export function approximateSearch(sequences: Seq[], targetEmbedding: number[], k: number): { sequence: Seq, similarity: number }[] {
    if (targetEmbedding.length === 0) {
        console.error("Target embedding is empty. Approximate search cannot proceed.");
        return [];
    }

    const similarities = sequences.map(seq => {
        if (seq.embedding.length !== targetEmbedding.length) {
            console.error("Embedding dimensionality mismatch.");
            return { sequence: seq, similarity: NaN };
        }
        return {
            sequence: seq,
            similarity: cosineSimilarity(seq.embedding, targetEmbedding),
        };
    });

    // Filter out invalid results (e.g., NaN similarities)
    const validSimilarities = similarities.filter(item => !isNaN(item.similarity));

    // Sort by similarity descending
    validSimilarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k closest sequences
    return validSimilarities.slice(0, k);
}

// Exact search, matches log key sequence to query
export function exactSearch(sequences: Seq[], targetLogkeySeq: string[]): Seq[] {
    return sequences.filter(seq =>
        seq.logkey_seq.length === targetLogkeySeq.length &&
        seq.logkey_seq.every((key, index) => key === targetLogkeySeq[index])
    );
}

function getSeqForQuery(
    data: { entityDict: EntityDict; actionDict: ActionDict; entitySequences: EntitySequences },
    query: string
): Seq[] {
    if (query === ROOT_QUERY) return data.entitySequences;
    if (data.entityDict[query]) return data.entityDict[query];
    if (data.actionDict[query]) return data.actionDict[query];
    return [];
}

/**
 * Folds the session's added Krone-seqs into what was loaded from CSV.
 *
 * Returns new objects rather than mutating: the parsed structures are state,
 * and the merged view is derived from them plus the additions, so removing an
 * addition (or switching dataset) recomputes cleanly.
 */
export function mergeAdditionsIntoKnowledge(
    data: KnowledgeBaseData,
    additions: KroneSeqAddition[]
): KnowledgeBaseData {
    if (!additions.length) return data;

    const entityDict: EntityDict = { ...data.entityDict };
    const actionDict: ActionDict = { ...data.actionDict };

    for (const addition of additions) {
        const seq: Seq = {
            arr: addition.nodeSequence,
            explanation: addition.explanation,
            seqType: "STATUS",
            isAnomaly: addition.isAnomaly,
            logkey_seq: addition.logKeys,
            embedding: [],
            path_summary: "",
        };
        actionDict[addition.actionId] = [...(actionDict[addition.actionId] ?? []), seq];
    }

    return { entityDict, actionDict, entitySequences: data.entitySequences };
}

/**
 * Creates the tree path an addition hangs off, level by level, for the case the
 * shipped tree has no node with that id -- which is common, because the tree and
 * the knowledge base were generated with independent node numbering.
 */
export function applyAdditionsToTree(tree: TreeNode | null, additions: KroneSeqAddition[]): TreeNode | null {
    if (!tree || !additions.length) return tree;

    // One shallow clone of the spine; the additions then graft onto it.
    const clone = (node: TreeNode): TreeNode => ({ ...node, children: node.children?.map(clone) });
    const root = clone(tree);

    for (const addition of additions) {
        root.children ??= [];
        let entityNode = root.children.find((child) => child.name === addition.entityId);
        if (!entityNode) {
            entityNode = { name: addition.entityId, children: [], isAddedInSession: true };
            root.children.push(entityNode);
        }

        entityNode.children ??= [];
        let actionNode = entityNode.children.find((child) => child.name === addition.actionId);
        if (!actionNode) {
            actionNode = { name: addition.actionId, children: [], isAddedInSession: true };
            entityNode.children.push(actionNode);
        }

        actionNode.children ??= [];
        for (const statusNode of addition.statusNodes) {
            if (actionNode.children.some((child) => child.name === statusNode.name)) continue;
            actionNode.children.push({
                name: statusNode.name,
                event_id: statusNode.eventId,
                log_template: statusNode.logTemplate,
                isAnomaly: addition.isAnomaly,
                anomalyReason: addition.explanation,
                isAddedInSession: true,
            });
        }
    }

    return root;
}

function buildSequenceStatsLookup(
    trainingData: KnowledgeBaseData,
    testingData: KnowledgeBaseData,
    tree: TreeNode,
    scope: DataScope
): SequenceStatsLookup {
    const lookup: SequenceStatsLookup = {};
    const seen = new Set<string>();

    const collectNodeNames = (node: TreeNode) => {
        seen.add(node.name);
        for (const child of node.children || []) {
            collectNodeNames(child);
        }
    };
    collectNodeNames(tree);

    for (const queryName of seen) {
        const combined = scope === "train"
            ? getSeqForQuery(trainingData, queryName)
            : scope === "test"
                ? getSeqForQuery(testingData, queryName)
                : [...getSeqForQuery(trainingData, queryName), ...getSeqForQuery(testingData, queryName)];
        let normal = 0;
        let abnormal = 0;
        for (const seq of combined) {
            if (seq.isAnomaly) abnormal += 1;
            else normal += 1;
        }
        lookup[queryName] = { normal, abnormal };
    }

    return lookup;
}

function attachSequenceStatsToTree(tree: TreeNode, lookup: SequenceStatsLookup): TreeNode {
    const clonedTree = JSON.parse(JSON.stringify(tree)) as TreeNode;

    const traverse = (node: TreeNode) => {
        const count = lookup[node.name] || { normal: 0, abnormal: 0 };
        node.sequenceStats = { normal: count.normal, abnormal: count.abnormal };
        for (const child of node.children || []) {
            traverse(child);
        }
    };

    traverse(clonedTree);
    return clonedTree;
}

// Full Knowlege Base Visualization Component - Includes tree and navbar
export const KnowledgeBaseViz = () => {
    const { fileFor, stats, dataset } = useDataset();
    const isSampled = Boolean(
        stats?.knowledge.train.sampled || stats?.knowledge.test.sampled
    );

    /* -- STATES -- */
    const [knowledgeStructures, setKnowledgeStructures] = useState<{
        trainingData: KnowledgeBaseData | null;
        testingData: KnowledgeBaseData | null;
        allSequences: Seq[];
    }>({
        trainingData: null,
        testingData: null,
        allSequences: [],
    });
    const [showSidebar, setShowSidebar] = useState(false);
    const [rawTreeData, setRawTreeData] = useState<TreeNode | null>(null);
    const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
    const [searchLogKey, setSearchLogKey] = useState<string>("");
    const [dataScope, setDataScope] = useState<DataScope>("all");
    // What this session added, folded in on top of what the CSVs shipped. A save
    // on the detection page lands in the test knowledge base, which is where a
    // verified anomaly belongs.
    const { additions } = useKnowledgeBaseAdditions();
    const datasetAdditions = useMemo(
        () => additions.filter((addition) => addition.dataset === dataset),
        [additions, dataset]
    );

    const mergedTree = useMemo(
        () => applyAdditionsToTree(rawTreeData, datasetAdditions),
        [rawTreeData, datasetAdditions]
    );
    const mergedTestingData = useMemo(
        () => (knowledgeStructures.testingData
            ? mergeAdditionsIntoKnowledge(knowledgeStructures.testingData, datasetAdditions)
            : null),
        [knowledgeStructures.testingData, datasetAdditions]
    );

    const sequenceStatsLookup = useMemo(() => {
        if (!mergedTree || !knowledgeStructures.trainingData || !mergedTestingData) return null;
        return buildSequenceStatsLookup(
            knowledgeStructures.trainingData,
            mergedTestingData,
            mergedTree,
            dataScope
        );
    }, [mergedTree, knowledgeStructures.trainingData, mergedTestingData, dataScope]);
    const treeData = useMemo(() => {
        if (!mergedTree || !sequenceStatsLookup) return mergedTree;
        return attachSequenceStatsToTree(mergedTree, sequenceStatsLookup);
    }, [mergedTree, sequenceStatsLookup]);

    // This page is read-only -- there is nothing to click through -- so the
    // hand-off to cost analysis lights up as soon as there is a tree to read.
    useStageComplete(!!treeData);

    /* -- LOCAL FUNCTIONS -- */
    const toggleSidebar = () => {
        if (showSidebar) {
            setSearchLogKey("");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        setShowSidebar(!showSidebar);

    };

    // When a node is clicked it query's the selected node and displays sidebar with that nodes children sequences
    const handleNodeClick = (node: { data: TreeNode }) => {
        if (node.data?.name) {
            setSelectedQuery(node.data.name);
            setShowSidebar(true);
            setSearchLogKey("");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    const query = useQuery();
    const logkeysParam = query.get("logkeys");
    const tabParam = query.get("tab");
    const [defaultTab, setDefaultTab] = useState<"train" | "test" | "approx">("train");

    useEffect(() => {
        if (logkeysParam && !showSidebar) {
            toggleSidebar();
        }
        if (tabParam) {
            setDefaultTab(tabParam as "train" | "test" | "approx");
        }
        if (logkeysParam) {
            setSearchLogKey(logkeysParam);
        }
    }, [logkeysParam, showSidebar, toggleSidebar]);

    // On component mount fetches the training and testing knowledge and builds their respective knowledge structures
    useEffect(() => {
        Promise.all([
            fetch(fileFor("train_knowledge_all")).then(res => res.text()),
            fetch(fileFor("test_knowledge_all_fixed2")).then(res => res.text()),
        ])
            .then(([trainCSV, testCSV]) => {
                let trainStructures: ReturnType<typeof buildKnowledgeStructures>;
                let testStructures: ReturnType<typeof buildKnowledgeStructures>;

                parseKnowledgeCSV(trainCSV, (train) => {
                    trainStructures = train;
                    parseKnowledgeCSV(testCSV, (test) => {
                        testStructures = test;

                        // Build training and testing data
                        const trainingData = {
                            entityDict: trainStructures.entityDict,
                            actionDict: trainStructures.actionDict,
                            entitySequences: trainStructures.entitySequences,
                        };

                        const testingData = {
                            entityDict: testStructures.entityDict,
                            actionDict: testStructures.actionDict,
                            entitySequences: testStructures.entitySequences,
                        };

                        // Combine both sets of sequences
                        const allSequences = [
                            ...trainStructures.allSequences,
                            ...testStructures.allSequences,
                        ];

                        // Set all knowledge structures in one go
                        setKnowledgeStructures({
                            trainingData,
                            testingData,
                            allSequences,
                        });
                    });
                });
            })
            .catch((error) => console.error("Error loading CSV files:", error));
    }, [fileFor]);

    useEffect(() => {
        fetch(fileFor("Krone_Tree"))
            .then(res => res.text())
            .then(csvText => {
                setRawTreeData(buildTree(Papa.parse(csvText, { header: true }).data as CSVRow[]));
            });
    }, [fileFor]);

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
            <div className="lg:hidden pt-[4.75rem]"></div>
            <SmallViewportWarning />
            <div
                className="hidden lg:flex"
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
                        <div
                            style={{
                                position: "sticky",
                                top: 0,
                                background: "#fff",
                                zIndex: 10,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                                marginBottom: 12,
                            }}
                        >
                            {/* This page consumes the knowledge base rather than
                                building it, so its actions row is empty -- but it
                                keeps its height, which is what holds the tree at
                                the same y as on the three pages before it. */}
                            <StageHeader
                                context={
                                    <>
                                        <DatasetChip />
                                        <span aria-hidden="true" style={{ color: "var(--n-300)" }}>|</span>
                                        <span>
                                            <b style={{ color: "var(--n-900)", fontWeight: 600 }}>
                                                {knowledgeStructures.allSequences.length}
                                            </b> Krone-seqs
                                        </span>
                                    </>
                                }
                                explanation={
                                    <>
                                        {KNOWLEDGE_BASE_DESC}
                                        {isSampled && (
                                            <> The demo ships a sample of this knowledge base, chosen to keep as many
                                            distinct patterns as it can.</>
                                        )}
                                    </>
                                }
                            />
                        </div>
                        {treeData && (
                            <VizTree
                                treeData={treeData}
                                collapseEntities={false}
                                collapseActions={false}
                                collapseStatuses={false}
                                matchedNodeId={null}
                                showAnomalySymbols={false}
                                collapsible={false}
                                disableHoverHighlight={false}
                                onNodeClick={handleNodeClick}
                                clickableNodes={true}
                                showStickyLevelHeaders={true}
                                compactVerticalSpacing={true}
                                extraColumnSpacing={[0, 10, 14, 14]}
                                showBadges={true}
                            />
                        )}
                    </div>
                </div>
                {knowledgeStructures.trainingData && mergedTestingData && (
                    <KnowledgeBaseSideBar
                        showSidebar={showSidebar}
                        toggleSidebar={toggleSidebar}
                        trainingData={knowledgeStructures.trainingData}
                        testingData={mergedTestingData}
                        query={
                            selectedQuery
                                ? selectedQuery === ROOT_QUERY
                                    ? "ROOT"
                                    : selectedQuery
                                : "blk_4"
                        }
                        initialSearchLogKey={searchLogKey}
                        defaultTab={defaultTab}
                        treeData={treeData!}
                        dataScope={dataScope}
                        setDataScope={setDataScope}
                    />
                )}
            </div>
            <div className="w-full fixed bottom-0">
                <Footer />
            </div>
        </div>
    );
};
