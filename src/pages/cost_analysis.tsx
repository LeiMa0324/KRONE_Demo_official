import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/footer";
import { withBase } from "@/lib/base-url";

const HEADER_TEXT = "Cost Analysis";
const DESCRIPTION = "KRONE reasons about a pattern once, stores it, and reuses it. This page counts the LLM calls that saves during testing.";

// One hue per cost model. Validated as a 3-slot categorical palette on a light surface.
const COLOR_SEQUENCE = "#2563eb";
const COLOR_DECOMPOSED = "#d97706";
const COLOR_KRONE = "#059669";

type CurvePoint = {
    sequences: number;
    wholeSequenceCalls: number;
    decomposedCalls: number;
    kroneCalls: number;
};

type LayerStat = {
    layer: string;
    total: number;
    trainHit: number;
    testHit: number;
    llmCall: number;
};

type ReusedPattern = {
    layer: string;
    label: string;
    count: number;
    fromTraining: boolean;
    savedCalls: number;
};

type CostStats = {
    train: { sequences: number; logMessages: number; kroneSeqs: number; storedPatterns: number };
    test: {
        sequences: number;
        logMessages: number;
        kroneSeqs: number;
        wholeSequenceCalls: number;
        decomposedCalls: number;
        kroneCalls: number;
        savedVsWholeSequence: number;
        savedVsWholeSequenceRate: number;
        savedVsDecomposed: number;
        savedVsDecomposedRate: number;
        servedFromTrainingKB: number;
        servedFromTestCache: number;
        newPatterns: number;
    };
    layers: LayerStat[];
    curve: CurvePoint[];
    topReused: ReusedPattern[];
};

const LAYER_LABEL: Record<string, string> = {
    ENTITY: "Entity layer",
    ACTION: "Action layer",
    STATUS: "Status layer",
};

const SERIES = [
    { key: "wholeSequenceCalls" as const, color: COLOR_SEQUENCE, label: "per log sequence", legend: "One call per log sequence" },
    { key: "decomposedCalls" as const, color: COLOR_DECOMPOSED, label: "per krone-seq", legend: "One call per krone-seq" },
    { key: "kroneCalls" as const, color: COLOR_KRONE, label: "KRONE", legend: "KRONE (store & retrieve)" },
];

const fmt = (value: number) => value.toLocaleString("en-US");

function compact(value: number) {
    if (value >= 1_000_000) return `${value / 1_000_000}M`;
    if (value >= 1_000) return `${value / 1_000}k`;
    return `${value}`;
}

// -- CumulativeCallChart -- Cumulative LLM calls as the test stream is replayed, under the three
// cost models. Log scale, because the three curves live three orders of magnitude apart.
function CumulativeCallChart({ curve }: { curve: CurvePoint[] }) {
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const W = 900;
    const H = 340;
    const M = { top: 24, right: 148, bottom: 48, left: 74 };
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;

    const last = curve[curve.length - 1];
    const maxX = last?.sequences ?? 1;
    const logMax = Math.log10(Math.max(last?.decomposedCalls ?? 10, 10)) + 0.08;

    const x = (v: number) => M.left + (v / maxX) * plotW;
    const y = (v: number) => M.top + plotH - (Math.log10(Math.max(v, 1)) / logMax) * plotH;

    const linePath = (key: keyof CurvePoint) =>
        curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.sequences).toFixed(2)},${y(p[key]).toFixed(2)}`).join(" ");

    const yTicks = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000].filter((tick) => Math.log10(tick) <= logMax);
    const xTicks = Array.from({ length: 5 }, (_, i) => (maxX / 4) * i);

    const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const viewX = ((event.clientX - rect.left) / rect.width) * W;
        const ratio = Math.min(1, Math.max(0, (viewX - M.left) / plotW));
        setHoverIndex(Math.round(ratio * (curve.length - 1)));
    };

    const hovered = hoverIndex === null ? null : curve[hoverIndex];

    return (
        <div className="relative">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto"
                role="img"
                aria-label="Cumulative LLM calls during testing under three cost models"
                onMouseMove={handleMove}
                onMouseLeave={() => setHoverIndex(null)}
            >
                {yTicks.map((tick) => (
                    <g key={tick}>
                        <line x1={M.left} x2={M.left + plotW} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" strokeWidth={1} />
                        <text x={M.left - 12} y={y(tick) + 4} textAnchor="end" className="fill-slate-500" fontSize={13}>
                            {compact(tick)}
                        </text>
                    </g>
                ))}
                <text x={16} y={M.top + plotH / 2} textAnchor="middle" className="fill-slate-500" fontSize={12} transform={`rotate(-90 16 ${M.top + plotH / 2})`}>
                    cumulative LLM calls (log scale)
                </text>

                {xTicks.map((tick) => (
                    <text key={tick} x={x(tick)} y={M.top + plotH + 26} textAnchor="middle" className="fill-slate-500" fontSize={13}>
                        {compact(Math.round(tick / 1000) * 1000)}
                    </text>
                ))}
                <text x={M.left + plotW / 2} y={H - 8} textAnchor="middle" className="fill-slate-500" fontSize={13}>
                    test log sequences processed
                </text>

                {SERIES.map((series) => (
                    <path key={series.key} d={linePath(series.key)} fill="none" stroke={series.color} strokeWidth={2} strokeLinecap="round" />
                ))}

                {SERIES.map((series) => (
                    <text key={series.key} x={M.left + plotW + 10} y={y(last?.[series.key] ?? 1) + 4} fill={series.color} fontSize={13} fontWeight={600}>
                        {series.label}
                    </text>
                ))}

                {hovered && (
                    <g>
                        <line
                            x1={x(hovered.sequences)}
                            x2={x(hovered.sequences)}
                            y1={M.top}
                            y2={M.top + plotH}
                            stroke="#94a3b8"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                        />
                        {SERIES.map((series) => (
                            <circle
                                key={series.key}
                                cx={x(hovered.sequences)}
                                cy={y(hovered[series.key])}
                                r={5}
                                fill={series.color}
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                        ))}
                    </g>
                )}
            </svg>

            {hovered && (
                <div
                    className="pointer-events-none absolute top-2 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left text-sm shadow-lg"
                    style={{ left: `${Math.min(64, (x(hovered.sequences) / W) * 100)}%` }}
                >
                    <div className="font-semibold text-slate-900">after {fmt(hovered.sequences)} sequences</div>
                    {SERIES.map((series) => (
                        <div key={series.key} className="mt-1 flex items-center gap-2 text-slate-700">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: series.color }} />
                            {series.legend}: {fmt(hovered[series.key])}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export const CostAnalysis = () => {
    const [stats, setStats] = useState<CostStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(withBase("cost_analysis_stats.json"))
            .then((res) => res.json())
            .then((data: CostStats) => {
                setStats(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error("Failed to load cost analysis statistics:", error);
                setLoading(false);
            });
    }, []);

    if (loading || !stats) {
        return (
            <div className="bg-white min-h-screen pt-[4.5rem] px-4 sm:px-8 md:px-16 lg:px-24">
                <div className="max-w-5xl mx-auto py-16 text-center text-xl font-WPIfont text-slate-700">
                    {loading ? "Loading cost analysis..." : "Cost analysis data is unavailable."}
                </div>
                <Footer />
            </div>
        );
    }

    const { test, train, layers, curve, topReused } = stats;

    const columns = [
        {
            color: COLOR_SEQUENCE,
            value: test.wholeSequenceCalls,
            title: "One call per log sequence",
            detail: "Hand the whole sequence to an LLM and ask for a verdict. One call each.",
        },
        {
            color: COLOR_DECOMPOSED,
            value: test.decomposedCalls,
            title: "One call per krone-seq",
            detail: "KRONE's hierarchy reasons at entity, action and status level — about 20 krone-seqs per sequence.",
        },
        {
            color: COLOR_KRONE,
            value: test.kroneCalls,
            highlight: true,
            title: "KRONE: store & retrieve",
            detail: "A krone-seq is reasoned about once, stored, and retrieved every time it reappears.",
            reductions: [
                { color: COLOR_SEQUENCE, factor: test.wholeSequenceCalls / test.kroneCalls },
                { color: COLOR_DECOMPOSED, factor: test.decomposedCalls / test.kroneCalls },
            ],
        },
    ];

    return (
        <div className="bg-white min-h-screen pt-[4.5rem] px-4 sm:px-8 md:px-16 lg:px-24">
            <div className="max-w-5xl mx-auto py-10">
                <div className="text-4xl font-WPIfont font-bold text-slate-900 mb-4">{HEADER_TEXT}</div>
                <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">{DESCRIPTION}</p>

                <p className="text-base text-slate-600 mb-4">
                    LLM calls needed to analyze all {fmt(test.sequences)} test log sequences ({fmt(test.logMessages)} log messages)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {columns.map((column) => (
                        <div
                            key={column.title}
                            className={
                                column.highlight
                                    ? "relative rounded-3xl border-2 border-emerald-500 bg-emerald-50 p-6 shadow-lg md:-my-3"
                                    : "rounded-3xl border border-slate-200 bg-slate-50 p-6 md:opacity-80"
                            }
                        >
                            {column.highlight && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                    KRONE
                                </span>
                            )}
                            <div className={`flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 ${column.highlight ? "mt-2" : ""}`}>
                                <span className={column.highlight ? "text-6xl font-bold" : "text-3xl font-bold"} style={{ color: column.color }}>
                                    {fmt(column.value)}
                                </span>
                                {column.reductions?.map((reduction) => (
                                    <span key={reduction.color} className="text-xl font-bold whitespace-nowrap" style={{ color: reduction.color }}>
                                        &darr;{fmt(Math.round(reduction.factor))}&times;
                                    </span>
                                ))}
                            </div>
                            <div className={`mt-3 font-semibold ${column.highlight ? "text-emerald-900" : "text-slate-700"}`}>{column.title}</div>
                            <p className={`mt-2 text-sm ${column.highlight ? "text-emerald-900/75" : "text-slate-500"}`}>{column.detail}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                    <h2 className="text-2xl font-semibold text-slate-900 mb-1">The cost stops growing</h2>
                    <p className="text-sm text-slate-600 mb-4 max-w-2xl mx-auto">
                        Both baselines keep climbing with every new log sequence. KRONE flattens: once a krone-seq is in the knowledge base, every later
                        occurrence is a retrieval instead of a call.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-2 text-sm text-slate-700">
                        {SERIES.map((series) => (
                            <span key={series.key} className="inline-flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: series.color }} />
                                {series.legend}
                            </span>
                        ))}
                    </div>
                    <CumulativeCallChart curve={curve} />
                </div>

                <details className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-left group">
                    <summary className="cursor-pointer text-lg font-semibold text-slate-900 list-none flex items-center justify-center gap-2">
                        <span>Details</span>
                        <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">&#9662;</span>
                    </summary>

                    <p className="mt-6 text-sm text-slate-600">
                        A test log sequence is split into krone-seqs &mdash; one at the entity layer, one per entity node at the action layer, one per action
                        node at the status layer. That is what makes KRONE's verdict explainable, and it is also why the middle column is ~20&times; the number
                        of sequences. Storing and retrieving those krone-seqs is what brings the cost back down: a call is spent only the first time a krone-seq
                        is seen, and never for one already stored during training. {fmt(train.storedPatterns)} patterns learned from {fmt(train.sequences)}{" "}
                        training log sequences ({fmt(train.logMessages)} log messages) cover {test.savedVsDecomposedRate.toFixed(2)}% of the test set.
                    </p>

                    <table className="mt-6 min-w-full text-left text-sm text-slate-700">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-900">
                            <tr>
                                <th className="px-3 py-3">Layer</th>
                                <th className="px-3 py-3">Krone-seqs</th>
                                <th className="px-3 py-3">LLM calls</th>
                                <th className="px-3 py-3">Avoided</th>
                            </tr>
                        </thead>
                        <tbody>
                            {layers.map((layer) => (
                                <tr key={layer.layer} className="border-b border-slate-100">
                                    <td className="px-3 py-3 font-medium text-slate-900">{LAYER_LABEL[layer.layer] ?? layer.layer}</td>
                                    <td className="px-3 py-3">{fmt(layer.total)}</td>
                                    <td className="px-3 py-3">{fmt(layer.llmCall)}</td>
                                    <td className="px-3 py-3">{(((layer.total - layer.llmCall) / layer.total) * 100).toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <h3 className="mt-8 mb-2 text-base font-semibold text-slate-900">Most reused krone-seqs</h3>
                    <table className="min-w-full text-left text-sm text-slate-700">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-900">
                            <tr>
                                <th className="px-3 py-3">Krone-seq</th>
                                <th className="px-3 py-3">Layer</th>
                                <th className="px-3 py-3">Reused</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topReused.slice(0, 10).map((pattern) => (
                                <tr key={`${pattern.layer}-${pattern.label}`} className="border-b border-slate-100">
                                    <td className="px-3 py-3 align-top max-w-[28rem] break-words">{pattern.label}</td>
                                    <td className="px-3 py-3 align-top">{LAYER_LABEL[pattern.layer] ?? pattern.layer}</td>
                                    <td className="px-3 py-3 align-top">{fmt(pattern.count)}&times;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            </div>
            <Footer />
        </div>
    );
};
