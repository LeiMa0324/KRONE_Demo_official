/**
 * Offline pre-computation for the Cost Analysis page.
 *
 * Replays the test log stream through the KRONE knowledge base and counts how
 * many LLM reasoning calls are avoided because a krone-seq was already stored
 * (from training) or had already been reasoned about earlier in the test run.
 *
 * Run with:  node scripts/compute_cost_stats.mjs
 * Output:    public/cost_analysis_stats.json
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const ROOT = path.resolve(import.meta.dirname, "..");
const TRAIN_DECOMPOSE = path.join(ROOT, "public/krone_train_decompose.csv");
const TEST_DECOMPOSE = path.join(ROOT, "public/krone_decompose_res.csv");
const OUT = path.join(ROOT, "public/cost_analysis_stats.json");

// Nodes arrive as "[a,b,c]" — one entry per log key, already aligned across layers.
function parseNodeList(field) {
    if (!field) return [];
    const inner = field.trim().replace(/^\[/, "").replace(/\]$/, "");
    if (!inner.trim()) return [];
    return inner.split(",").map((s) => s.trim());
}

// A krone-seq collapses consecutive repeats of the same node into one step.
function collapse(nodes) {
    const out = [];
    for (const node of nodes) {
        if (out[out.length - 1] !== node) out.push(node);
    }
    return out;
}

// Maximal runs of an identical node, as [start, endExclusive] index pairs.
function runs(nodes, from, to) {
    const out = [];
    let start = from;
    for (let i = from + 1; i <= to; i++) {
        if (i === to || nodes[i] !== nodes[start]) {
            out.push([start, i]);
            start = i;
        }
    }
    return out;
}

/**
 * Every krone-seq a single log sequence gives rise to: one entity-layer path,
 * one action-layer path per entity node, one status-layer path per action node.
 * Each one is a unit of reasoning that costs an LLM call when it is not in the KB.
 */
function kroneSeqsOf(row) {
    const entity = parseNodeList(row.entity_nodes_for_logkeys);
    const action = parseNodeList(row.action_nodes_for_logkeys);
    const status = parseNodeList(row.status_nodes_for_logkeys);
    const n = Math.min(entity.length, action.length, status.length);
    if (n === 0) return [];

    const seqs = [{ layer: "ENTITY", key: `ENTITY|${collapse(entity.slice(0, n)).join("||")}` }];

    for (const [eStart, eEnd] of runs(entity, 0, n)) {
        const actionPath = collapse(action.slice(eStart, eEnd));
        seqs.push({ layer: "ACTION", key: `ACTION|${entity[eStart]}|${actionPath.join("||")}` });

        for (const [aStart, aEnd] of runs(action, eStart, eEnd)) {
            const statusPath = status.slice(aStart, aEnd);
            seqs.push({
                layer: "STATUS",
                key: `STATUS|${entity[eStart]}|${action[aStart]}|${statusPath.join("||")}`,
            });
        }
    }
    return seqs;
}

function readRows(file) {
    console.log(`reading ${path.basename(file)} ...`);
    const text = fs.readFileSync(file, "utf8");
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

const LAYERS = ["ENTITY", "ACTION", "STATUS"];
const emptyLayerStats = () => Object.fromEntries(LAYERS.map((l) => [l, { total: 0, trainHit: 0, testHit: 0, llmCall: 0 }]));

// --- 1. Build the knowledge base from training ------------------------------
const trainRows = readRows(TRAIN_DECOMPOSE);
const trainKB = new Set();
let trainSeqUnits = 0;
let trainMessages = 0;
for (const row of trainRows) {
    trainMessages += parseNodeList(row.entity_nodes_for_logkeys).length;
    for (const seq of kroneSeqsOf(row)) {
        trainSeqUnits += 1;
        trainKB.add(seq.key);
    }
}
console.log(`train: ${trainRows.length} sequences, ${trainSeqUnits} krone-seqs, ${trainKB.size} stored patterns`);

// --- 2. Replay the test stream against it -----------------------------------
const testRows = readRows(TEST_DECOMPOSE);
const layerStats = emptyLayerStats();
const seenAtTest = new Set();
const reuse = new Map(); // pattern -> { key, layer, label, count, fromTraining }

let total = 0;
let testMessages = 0;
let trainHit = 0;
let testHit = 0;
let llmCall = 0;

const CURVE_POINTS = 120;
const curveEvery = Math.max(1, Math.floor(testRows.length / CURVE_POINTS));
const curve = [];

testRows.forEach((row, index) => {
    testMessages += parseNodeList(row.entity_nodes_for_logkeys).length;
    for (const seq of kroneSeqsOf(row)) {
        total += 1;
        layerStats[seq.layer].total += 1;

        const inTrainKB = trainKB.has(seq.key);
        const seenBefore = seenAtTest.has(seq.key);

        if (inTrainKB) {
            trainHit += 1;
            layerStats[seq.layer].trainHit += 1;
        } else if (seenBefore) {
            testHit += 1;
            layerStats[seq.layer].testHit += 1;
        } else {
            llmCall += 1;
            layerStats[seq.layer].llmCall += 1;
            seenAtTest.add(seq.key);
        }

        const entry = reuse.get(seq.key);
        if (entry) {
            entry.count += 1;
        } else {
            reuse.set(seq.key, {
                layer: seq.layer,
                label: seq.key.split("|").slice(1).join(" · ").replaceAll("||", " → "),
                count: 1,
                fromTraining: inTrainKB,
            });
        }
    }

    if (index % curveEvery === 0 || index === testRows.length - 1) {
        curve.push({
            sequences: index + 1,
            wholeSequenceCalls: index + 1, // one flat LLM call per log sequence
            decomposedCalls: total, // one call per krone-seq, no reuse
            kroneCalls: llmCall, // krone-seqs that were actually new
        });
    }
});

const topReused = Array.from(reuse.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)
    .map((item) => ({ ...item, savedCalls: item.fromTraining ? item.count : item.count - 1 }));

const stats = {
    generatedFrom: {
        train: path.basename(TRAIN_DECOMPOSE),
        test: path.basename(TEST_DECOMPOSE),
    },
    train: {
        sequences: trainRows.length,
        logMessages: trainMessages,
        kroneSeqs: trainSeqUnits,
        storedPatterns: trainKB.size,
    },
    test: {
        sequences: testRows.length,
        logMessages: testMessages,
        kroneSeqs: total,
        // The three cost points the page compares.
        wholeSequenceCalls: testRows.length,
        decomposedCalls: total,
        kroneCalls: llmCall,
        savedVsWholeSequence: testRows.length - llmCall,
        savedVsWholeSequenceRate: testRows.length === 0 ? 0 : ((testRows.length - llmCall) / testRows.length) * 100,
        savedVsDecomposed: total - llmCall,
        savedVsDecomposedRate: total === 0 ? 0 : ((total - llmCall) / total) * 100,
        servedFromTrainingKB: trainHit,
        servedFromTestCache: testHit,
        newPatterns: llmCall,
    },
    layers: LAYERS.map((layer) => ({ layer, ...layerStats[layer] })),
    curve,
    topReused,
};

fs.writeFileSync(OUT, JSON.stringify(stats, null, 2));
console.log(
    `test: ${testRows.length} sequences → ${total} krone-seqs → ${llmCall} LLM calls ` +
        `(${stats.test.savedVsDecomposedRate.toFixed(2)}% vs decomposed, ${stats.test.savedVsWholeSequenceRate.toFixed(2)}% vs per-sequence)`
);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
