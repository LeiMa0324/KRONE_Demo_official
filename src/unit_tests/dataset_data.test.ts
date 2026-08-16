import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { DATASET_KEYS } from "@/datasets";
import type { DatasetKey } from "@/datasets";

/**
 * The demo joins its CSVs to each other by hand -- log keys to tree rows, KB
 * identifiers to node names -- and every one of those joins fails quietly. A
 * decompose sequence naming a log key the tree does not have renders blank
 * nodes; a knowledge file with no ENTITY rows empties the root query and zeroes
 * every entity badge, which is what a first cut of the BGL row cap did. These
 * check the shipped files rather than the code, so regenerating public/data/
 * with scripts/build_demo_data.py is what they guard.
 */

const PUBLIC = resolve(__dirname, "../../public/data");

const read = <T,>(dataset: DatasetKey, file: string): T[] =>
  Papa.parse<T>(readFileSync(resolve(PUBLIC, dataset, `${file}.csv`), "utf8"), {
    header: true,
    skipEmptyLines: true,
  }).data;

/** Both the seq and the node columns are bracketed lists; see parseArray(). */
const parseArray = (value: string): string[] =>
  (value || "")
    .replace(/[[\]'"]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

type TreeRow = { event_id: string; entity_node_id: string; action_node_id: string };
type DecompRow = { seq_id: string; seq: string };
type KnowledgeRow = { path_layer: string };

const manifest = JSON.parse(readFileSync(resolve(PUBLIC, "manifest.json"), "utf8")) as {
  datasets: { key: string }[];
};

describe("shipped dataset files", () => {
  it("has a manifest entry for every dataset the UI offers", () => {
    expect(manifest.datasets.map((d) => d.key).sort()).toEqual([...DATASET_KEYS].sort());
  });

  describe.each(DATASET_KEYS)("%s", (dataset) => {
    const tree = read<TreeRow>(dataset, "Krone_Tree");

    it("has a non-empty krone-tree", () => {
      expect(tree.length).toBeGreaterThan(0);
      expect(new Set(tree.map((r) => r.entity_node_id)).size).toBeGreaterThan(0);
    });

    it.each(["krone_decompose_res", "krone_train_decompose"])(
      "%s only references log keys the tree defines",
      (file) => {
        const known = new Set(tree.map((r) => String(r.event_id).trim()));
        const rows = read<DecompRow>(dataset, file);
        expect(rows.length).toBeGreaterThan(0);
        const missing = new Set<string>();
        for (const row of rows) {
          for (const key of parseArray(row.seq)) {
            if (!known.has(key)) missing.add(key);
          }
        }
        expect([...missing]).toEqual([]);
      }
    );

    it("detection rows line up with shipped decompose sequences", () => {
      const shipped = new Set(read<DecompRow>(dataset, "krone_decompose_res").map((r) => r.seq_id));
      const detection = read<DecompRow>(dataset, "krone_detection_res");
      expect(detection.length).toBeGreaterThan(0);
      expect(detection.some((row) => shipped.has(row.seq_id))).toBe(true);
    });

    it.each(["train_knowledge_all", "test_knowledge_all_fixed2"])("%s keeps all three path layers", (file) => {
      const rows = read<KnowledgeRow>(dataset, file);
      expect(rows.length).toBeGreaterThan(0);
      const layers = new Set(rows.map((r) => (r.path_layer || "").trim().toUpperCase()));
      for (const layer of ["ENTITY", "ACTION", "STATUS"]) {
        expect(layers).toContain(layer);
      }
    });
  });
});
