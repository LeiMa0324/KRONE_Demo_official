#!/usr/bin/env python3
"""Derive the CSVs the demo ships from the full research outputs.

The demo used to serve the raw files straight out of public/, roughly 180 MB
across four CSVs for HDFS alone, and neither of the two things that made them
that large ever reached the UI:

  * pattern_embedding is a 768-dimension vector serialised as text, about
    16 KB per row against 244 bytes for every other column combined. It is
    read only by approximateSearch(), which nothing calls.
  * the decompose files carry tens of thousands of sequences, but the page
    slices to SEQUENCE_LIMIT immediately after parsing, so the rest were
    downloaded and thrown away.

Slicing here rather than in the browser is byte-for-byte the same result on
screen.

Output layout, one directory per dataset:

    public/data/<Dataset>/Krone_Tree.csv                entity/action/status hierarchy
    public/data/<Dataset>/structured_processes.csv      event_id -> log_template
    public/data/<Dataset>/krone_decompose_res.csv       detection page sequences
    public/data/<Dataset>/krone_train_decompose.csv     training page sequences
    public/data/<Dataset>/krone_detection_res.csv       anomaly segments + reasons
    public/data/<Dataset>/train_knowledge_all.csv       knowledge base, training half
    public/data/<Dataset>/test_knowledge_all_fixed2.csv knowledge base, testing half
    public/data/manifest.json                           row totals the UI reports

These are the filenames the demo has always used, unchanged; the only difference
is that they now sit one level down, under the dataset they belong to.

Inputs are looked up in data_raw/<Dataset>/ first, and fall back to the
research repos next to this one (override the location with
KRONE_RESEARCH_ROOT). data_raw/ is where HDFS lives, because the HDFS demo
ships a hand-curated knowledge base that upstream does not have.

Run this whenever the source data is regenerated:

    python3 scripts/build_demo_data.py
    python3 scripts/build_demo_data.py --datasets BGL ThunderBird
"""

from __future__ import annotations

import argparse
import ast
import csv
import json
import os
import sys
from pathlib import Path

csv.field_size_limit(10**9)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw"
OUT = ROOT / "public" / "data"
RESEARCH = Path(os.environ.get("KRONE_RESEARCH_ROOT", ROOT.parent))

# Must match SEQUENCE_DROPDOWN_LIMIT in src/pages/visualize_table.tsx.
SEQUENCE_LIMIT = 1000

# How many normal sequences to decompose for the training page when the
# dataset has no pre-built training decompose (BGL, ThunderBird). The upstream
# krone-viz.py used 1% of the sequence file; 400 matches the size of the
# detection-side decompose and keeps the dropdown comparable across datasets.
TRAIN_DECOMPOSE_LIMIT = 400

# The knowledge base drives both /knowledge-base and /cost-analysis. BGL's is
# 160k rows / 2.4 GB raw, which is not something a demo page can download, so
# it gets capped. Capping keeps every distinct pattern it can before it starts
# dropping repeats, because /cost-analysis measures pattern overlap between the
# training and testing halves — losing a pattern would move that number, losing
# a duplicate of one it already has will not.
KNOWLEDGE_ROW_LIMIT = 6000

# The only knowledge columns src/pages/knowledge_base_viz.tsx reads. Whitelisting
# rather than blacklisting also normalises the three datasets, whose headers
# differ in how many stray "Unnamed: 0" index columns pandas left behind, and it
# drops overall_identifier -- 13 MB of BGL's testing half on its own, and read by
# nothing in the UI.
KNOWLEDGE_COLUMNS = [
    "path_layer",
    "entity_identifier",
    "action_identifier",
    "status_identifier",
    "logkey_seq",
    "path_summary",
    "path_pred",
    "path_reason",
]

DECOMPOSE_COLUMNS = [
    "seq_id",
    "seq",
    "entity_nodes_for_logkeys",
    "action_nodes_for_logkeys",
    "status_nodes_for_logkeys",
]

DETECTION_COLUMNS = [
    "seq_id",
    "seq",
    "anomaly_seg",
    "anomaly_level",
    "anomaly_reason",
]

# Column names KroneTree.construct() is driven by; see
# KRONE_official/executor/executor.py.
ENTITY_COL = "entity_1"
ACTION_COL = "action_1"


# Internal handle -> the basename it is written and read under. The handles are
# what this script talks about; the basenames are what the demo has always
# called these files, and what src/datasets.ts asks for.
FILENAMES = {
    "krone_tree": "Krone_Tree",
    "templates": "structured_processes",
    "decompose_test": "krone_decompose_res",
    "decompose_train": "krone_train_decompose",
    "detection": "krone_detection_res",
    "train_knowledge": "train_knowledge_all",
    "test_knowledge": "test_knowledge_all_fixed2",
}


class Dataset:
    def __init__(self, key, label, blurb, sources, sequences=None):
        self.key = key
        self.label = label
        self.blurb = blurb
        self.sources = sources
        self.sequences = sequences

    def source(self, name: str) -> Path | None:
        """data_raw/<Dataset>/ wins over the upstream research repo."""
        local = RAW / self.key / f"{FILENAMES[name]}.csv"
        if local.exists():
            return local
        upstream = self.sources.get(name)
        if upstream and upstream.exists():
            return upstream
        return None

    def out(self, name: str) -> Path:
        return OUT / self.key / f"{FILENAMES[name]}.csv"


def official(dataset: str, name: str) -> Path:
    return RESEARCH / "KRONE_official" / "output" / dataset / name


def official_data(dataset: str, name: str) -> Path:
    return RESEARCH / "KRONE_official" / "data" / dataset / name


def upstream_sources(dataset: str) -> dict[str, Path]:
    return {
        "templates": official(dataset, "templates_krone_tree.csv"),
        "decompose_test": official(dataset, "krone_decompose_res.csv"),
        "detection": official(dataset, "krone_detection_res.csv"),
        "train_knowledge": official(dataset, "train_knowledge_all.csv"),
        "test_knowledge": official(dataset, "test_knowledge_all_fixed2.csv"),
    }


DATASETS = [
    Dataset(
        "HDFS",
        "HDFS",
        "Hadoop Distributed File System block traces.",
        upstream_sources("HDFS"),
        sequences=official_data("HDFS", "HDFS_demo_sequences.csv"),
    ),
    Dataset(
        "BGL",
        "BGL",
        "Blue Gene/L supercomputer RAS logs.",
        upstream_sources("BGL"),
        sequences=official_data("BGL", "BGL_demo_sequences.csv"),
    ),
    Dataset(
        "ThunderBird",
        "Thunderbird",
        "Thunderbird supercomputer system logs.",
        upstream_sources("ThunderBird"),
        sequences=official_data("ThunderBird", "ThunderBird_demo_sequences.csv"),
    ),
]


def human(num_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024 or unit == "GB":
            return f"{num_bytes:.1f}{unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f}GB"


def read_rows(path: Path) -> list[dict]:
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def write_rows(path: Path, columns: list[str], rows) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            written += 1
    return written


# --------------------------------------------------------------------------
# Krone-tree
# --------------------------------------------------------------------------


def base_name(name) -> str:
    """create_node() truncates every name at its first underscore."""
    return str(name).split("_")[0]


def is_none(value) -> bool:
    return str(value).strip() in ("none", "None")


def build_krone_tree(templates: list[dict]) -> dict[str, tuple[str, str, str]]:
    """Replay KroneTree.construct()'s node numbering over the template table.

    The demo needs event_id -> (entity, action, status) node identifiers, and
    those identifiers are positional: each is "<name>_<n>" where n is how many
    nodes of that level existed when it was created. The decompose CSVs already
    contain the identifiers, but only for the event ids that happen to appear in
    a sampled sequence -- 242 of ThunderBird's 1206 templates -- so reading them
    back out would give a tree with most of its branches missing. Replaying the
    numbering here reproduces the whole tree, and agrees with every identifier
    the decompose files do contain, on all three datasets.

    One faithfulness note: upstream's none-action mask is
    ``~((p[action] == 'none') | p[action] == 'None')``, and ``|`` binds tighter
    than ``==`` in Python, so the mask is really ``((p[action] == 'none') |
    p[action]) == 'None'`` -- always false. The none-action branch therefore
    never runs, and rows whose action is "none" go through the ordinary path.
    Replaying it the way it was written is what matches the shipped ids;
    replaying it the way it reads matches 21 of BGL's 224.
    """
    counters = {"ENTITY": 0, "ACTION": 0, "STATUS": 0}
    node_ids: dict[str, tuple[str, str, str]] = {}

    def create(name, level: str) -> str:
        identifier = f"{base_name(name)}_{counters[level]}"
        counters[level] += 1
        return identifier

    def unique(rows, column):
        seen = []
        for row in rows:
            if row[column] not in seen:
                seen.append(row[column])
        return seen

    none_entity_rows = [r for r in templates if is_none(r[ENTITY_COL])]
    named_entity_rows = [r for r in templates if not is_none(r[ENTITY_COL])]

    for entity_name in unique(named_entity_rows, ENTITY_COL):
        entity_rows = [r for r in templates if r[ENTITY_COL] == entity_name]
        entity_id = create(entity_name, "ENTITY")

        for action_name in unique(entity_rows, ACTION_COL):
            action_rows = [r for r in entity_rows if r[ACTION_COL] == action_name]
            action_id = create(action_name, "ACTION")
            for row in action_rows:
                status_id = create(row["status"], "STATUS")
                node_ids[str(row["event_id"]).strip()] = (entity_id, action_id, status_id)

    for row in none_entity_rows:
        entity_id = create(base_name(row[ENTITY_COL]), "ENTITY")
        action_id = create(base_name(row[ACTION_COL]), "ACTION")
        status_id = create(base_name(row["status"]), "STATUS")
        node_ids[str(row["event_id"]).strip()] = (entity_id, action_id, status_id)

    return node_ids


def verify_against_decompose(node_ids, decompose_rows, dataset: str) -> int:
    """Cross-check the replayed ids against the ones baked into the decompose file."""
    checked = 0
    for row in decompose_rows:
        if not row.get("entity_nodes_for_logkeys"):
            continue
        try:
            seq = [str(e) for e in ast.literal_eval(row["seq"])]
        except (ValueError, SyntaxError):
            continue
        actual = zip(
            row["entity_nodes_for_logkeys"][1:-1].split(","),
            row["action_nodes_for_logkeys"][1:-1].split(","),
            row["status_nodes_for_logkeys"][1:-1].split(","),
        )
        for event_id, triple in zip(seq, actual):
            expected = node_ids.get(event_id)
            if expected is None:
                sys.exit(f"{dataset}: event {event_id} is in a sequence but not in the templates")
            if expected != triple:
                sys.exit(
                    f"{dataset}: node id mismatch for event {event_id}: "
                    f"replayed {expected}, decompose file says {triple}"
                )
            checked += 1
    return checked


# --------------------------------------------------------------------------
# Per-file jobs
# --------------------------------------------------------------------------


def emit_tree_and_templates(ds: Dataset, node_ids, templates) -> None:
    tree_rows = []
    template_rows = []
    for row in templates:
        event_id = str(row["event_id"]).strip()
        ids = node_ids.get(event_id)
        if ids is None:
            continue
        entity_id, action_id, status_id = ids
        tree_rows.append(
            {
                "event_id": event_id,
                "log_template": row.get("log_template", ""),
                "entity_node_id": entity_id,
                "action_node_id": action_id,
                "status_node_id": status_id,
                "is_anomaly": row.get("is_anomaly", "False"),
                "is_anomaly_reason": row.get("is_anomaly_reason", ""),
            }
        )
        template_rows.append({"event_id": event_id, "log_template": row.get("log_template", "")})

    write_rows(
        ds.out("krone_tree"),
        [
            "event_id",
            "log_template",
            "entity_node_id",
            "action_node_id",
            "status_node_id",
            "is_anomaly",
            "is_anomaly_reason",
        ],
        tree_rows,
    )
    write_rows(ds.out("templates"), ["event_id", "log_template"], template_rows)


def emit_decompose(ds: Dataset, name: str, source: Path) -> tuple[int, int]:
    rows = read_rows(source)
    written = write_rows(OUT / ds.key / f"{name}.csv", DECOMPOSE_COLUMNS, rows[:SEQUENCE_LIMIT])
    return len(rows), written


def generate_train_decompose(ds: Dataset, node_ids) -> tuple[int, int]:
    """Rebuild the training-page decompose the way upstream's krone-viz.py did.

    Take normal (Label == 0) sequences off the dataset's sequence file and map
    each log key through the tree to its entity / action / status node.
    """
    if not ds.sequences or not ds.sequences.exists():
        sys.exit(f"{ds.key}: need {ds.sequences} to build the training decompose")

    rows = read_rows(ds.sequences)
    total_normal = 0
    out_rows = []
    skipped = 0
    for row in rows:
        if str(row.get("Label", "")).strip() not in ("0", "0.0"):
            continue
        total_normal += 1
        if len(out_rows) >= TRAIN_DECOMPOSE_LIMIT:
            continue
        try:
            seq = [str(e).strip() for e in ast.literal_eval(row["EventSequence"])]
        except (ValueError, SyntaxError):
            skipped += 1
            continue
        if not seq or any(e not in node_ids for e in seq):
            skipped += 1
            continue
        triples = [node_ids[e] for e in seq]
        out_rows.append(
            {
                "seq_id": row.get("seq_id", ""),
                "seq": "[" + ", ".join(f"'{e}'" for e in seq) + "]",
                "entity_nodes_for_logkeys": "[" + ",".join(t[0] for t in triples) + "]",
                "action_nodes_for_logkeys": "[" + ",".join(t[1] for t in triples) + "]",
                "status_nodes_for_logkeys": "[" + ",".join(t[2] for t in triples) + "]",
            }
        )

    written = write_rows(ds.out("decompose_train"), DECOMPOSE_COLUMNS, out_rows)
    if skipped:
        print(f"    {ds.key}: skipped {skipped} training sequence(s) with unknown log keys")
    return total_normal, written


def emit_detection(ds: Dataset, source: Path) -> int:
    rows = read_rows(source)
    return write_rows(ds.out("detection"), DETECTION_COLUMNS, rows)


def pattern_key(row: dict) -> str:
    """Mirror getPatternKey() in src/pages/cost_analysis.tsx."""
    layer = (row.get("path_layer") or "").strip().upper()
    column = {
        "STATUS": "status_identifier",
        "ACTION": "action_identifier",
        "ENTITY": "entity_identifier",
    }.get(layer)
    if column is None:
        return f"{layer}|"
    parts = [p.strip() for p in (row.get(column) or "").split(",") if p.strip()]
    return f"{layer}|{'||'.join(parts)}"


def sample_layer(rows: list[tuple[int, dict]], budget: int) -> list[tuple[int, dict]]:
    """Pick `budget` rows out of one path_layer, distinct patterns first.

    Losing a pattern moves /cost-analysis's retrieval rate; losing a duplicate of
    one already kept does not, so duplicates are what gets spent first. The
    duplicates that do survive are spread evenly through the layer rather than
    taken off its front.
    """
    if len(rows) <= budget:
        return rows

    seen: set[str] = set()
    firsts: list[tuple[int, dict]] = []
    repeats: list[tuple[int, dict]] = []
    for indexed in rows:
        key = pattern_key(indexed[1])
        if key in seen:
            repeats.append(indexed)
        else:
            seen.add(key)
            firsts.append(indexed)

    kept = firsts[:budget]
    remaining = budget - len(kept)
    if remaining > 0 and repeats:
        stride = max(1, len(repeats) // remaining)
        kept.extend(repeats[::stride][:remaining])
    return kept


def emit_knowledge(ds: Dataset, name: str, source: Path) -> tuple[int, int, bool]:
    """Copy the knowledge base across, capped at KNOWLEDGE_ROW_LIMIT rows.

    The cap is split across the three path_layers in proportion to how many rows
    each has. Sampling the file as one pool does not work: BGL's training half
    leads with 100k STATUS rows, enough to spend the whole budget before the
    first ENTITY row, and an empty ENTITY layer empties the knowledge base's root
    query and zeroes every entity badge on the tree.
    """
    rows = read_rows(source)
    total = len(rows)
    if total <= KNOWLEDGE_ROW_LIMIT:
        written = write_rows(ds.out(name), KNOWLEDGE_COLUMNS, rows)
        return total, written, False

    by_layer: dict[str, list[tuple[int, dict]]] = {}
    for index, row in enumerate(rows):
        layer = (row.get("path_layer") or "").strip().upper()
        by_layer.setdefault(layer, []).append((index, row))

    # Largest-remainder apportionment, so the quotas add up to the budget exactly
    # and no non-empty layer is rounded out of existence.
    quotas = {}
    remainders = []
    assigned = 0
    for layer, layer_rows in by_layer.items():
        exact = KNOWLEDGE_ROW_LIMIT * len(layer_rows) / total
        quotas[layer] = max(1, int(exact))
        assigned += quotas[layer]
        remainders.append((exact - int(exact), layer))
    for _, layer in sorted(remainders, reverse=True):
        if assigned >= KNOWLEDGE_ROW_LIMIT:
            break
        if quotas[layer] < len(by_layer[layer]):
            quotas[layer] += 1
            assigned += 1

    kept: list[tuple[int, dict]] = []
    for layer, layer_rows in by_layer.items():
        kept.extend(sample_layer(layer_rows, quotas[layer]))
    kept.sort(key=lambda pair: pair[0])

    written = write_rows(ds.out(name), KNOWLEDGE_COLUMNS, [row for _, row in kept])
    return total, written, True


# --------------------------------------------------------------------------


def build(ds: Dataset) -> dict:
    print(f"\n=== {ds.key} ===")
    templates_path = ds.source("templates")
    if templates_path is None:
        sys.exit(
            f"{ds.key}: no templates file. Put one at {RAW / ds.key / 'structured_processes.csv'} "
            f"or point KRONE_RESEARCH_ROOT at the research repos."
        )

    templates = read_rows(templates_path)
    node_ids = build_krone_tree(templates)
    emit_tree_and_templates(ds, node_ids, templates)
    print(f"  Krone_Tree.csv              {len(templates)} templates, {len(node_ids)} placed in the tree")

    decompose_test_path = ds.source("decompose_test")
    if decompose_test_path is None:
        sys.exit(f"{ds.key}: no decompose_test source")
    decompose_rows = read_rows(decompose_test_path)
    checked = verify_against_decompose(node_ids, decompose_rows, ds.key)
    print(f"  node ids verified against {checked} log keys in the decompose file")

    test_total = write_rows(
        ds.out("decompose_test"), DECOMPOSE_COLUMNS, decompose_rows[:SEQUENCE_LIMIT]
    )
    print(f"  krone_decompose_res.csv     {test_total} of {len(decompose_rows)} sequences")

    train_source = ds.source("decompose_train")
    if train_source is not None:
        rows = read_rows(train_source)
        train_total = len(rows)
        train_written = write_rows(
            ds.out("decompose_train"), DECOMPOSE_COLUMNS, rows[:SEQUENCE_LIMIT]
        )
        print(f"  krone_train_decompose.csv   {train_written} of {train_total} sequences")
    else:
        train_total, train_written = generate_train_decompose(ds, node_ids)
        print(
            f"  krone_train_decompose.csv   {train_written} of {train_total} normal sequences (generated)"
        )

    detection_path = ds.source("detection")
    if detection_path is None:
        sys.exit(f"{ds.key}: no detection source")
    detected = emit_detection(ds, detection_path)
    print(f"  krone_detection_res.csv     {detected} sequences")

    knowledge = {}
    for half, name in (("train", "train_knowledge"), ("test", "test_knowledge")):
        path = ds.source(name)
        if path is None:
            sys.exit(f"{ds.key}: no {name} source")
        total, written, sampled = emit_knowledge(ds, name, path)
        knowledge[half] = {"total": total, "shipped": written, "sampled": sampled}
        note = f"  (sampled from {total})" if sampled else ""
        print(f"  {FILENAMES[name] + '.csv':27s} {written} rows{note}")

    shipped = sum(p.stat().st_size for p in (OUT / ds.key).glob("*.csv"))
    print(f"  shipped {human(shipped)}")

    return {
        "key": ds.key,
        "label": ds.label,
        "description": ds.blurb,
        "templateCount": len(node_ids),
        "testSequences": {"total": len(decompose_rows), "shipped": test_total},
        "trainSequences": {"total": train_total, "shipped": train_written},
        "detectionSequences": detected,
        "knowledge": knowledge,
        "bytes": shipped,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--datasets",
        nargs="+",
        choices=[d.key for d in DATASETS],
        help="only rebuild these (default: all)",
    )
    args = parser.parse_args()

    selected = [d for d in DATASETS if not args.datasets or d.key in args.datasets]

    print(f"data_raw       {RAW}")
    print(f"research root  {RESEARCH}")
    print(f"writing to     {OUT}")

    manifest_path = OUT / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        manifest = {d["key"]: d for d in json.loads(manifest_path.read_text())["datasets"]}

    for ds in selected:
        manifest[ds.key] = build(ds)

    ordered = [manifest[d.key] for d in DATASETS if d.key in manifest]
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps({"datasets": ordered}, indent=2) + "\n")

    total = sum(d["bytes"] for d in ordered)
    print(f"\nmanifest -> {manifest_path}")
    print(f"total shipped: {human(total)}")


if __name__ == "__main__":
    main()
