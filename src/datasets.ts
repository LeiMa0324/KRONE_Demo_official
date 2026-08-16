import { withBase } from "@/lib/base-url";

/**
 * The demo ships one directory of CSVs per dataset under public/data/, all with
 * the same seven filenames, written by scripts/build_demo_data.py. Everything
 * that reads data goes through datasetFile() so that adding a fourth dataset is
 * a matter of running the script and adding a line to DATASETS.
 */
/**
 * BGL is withheld: its shipped tree, decompose output and knowledge base come
 * from three different pipeline runs and share no node ids, so selecting it
 * rendered an empty tree and an empty knowledge base. Re-export the four files
 * from one run, drop them in data_raw/BGL/, run scripts/build_demo_data.py, and
 * put "BGL" back in this list.
 */
export const DATASET_KEYS = ["HDFS", "ThunderBird"] as const;

export type DatasetKey = (typeof DATASET_KEYS)[number];

/**
 * The seven filenames each dataset directory holds. These are the names the demo
 * has always used; the only change is that they now live one level down, under
 * the dataset they belong to.
 *
 * krone_decompose_res is the testing-side decompose (the detection page) and
 * krone_train_decompose is the training-side one.
 */
export type DatasetFile =
  | "Krone_Tree"
  | "structured_processes"
  | "krone_decompose_res"
  | "krone_train_decompose"
  | "krone_detection_res"
  | "train_knowledge_all"
  | "test_knowledge_all_fixed2";

export type DatasetInfo = {
  key: DatasetKey;
  label: string;
  description: string;
};

export const DATASETS: DatasetInfo[] = [
  { key: "HDFS", label: "HDFS", description: "Hadoop Distributed File System block traces." },
  { key: "ThunderBird", label: "Thunderbird", description: "Thunderbird supercomputer system logs." },
];

export const DEFAULT_DATASET: DatasetKey = "HDFS";

/** Row counts, written alongside the CSVs by the build script. */
export type DatasetCounts = {
  total: number;
  shipped: number;
};

export type DatasetManifestEntry = {
  key: DatasetKey;
  label: string;
  description: string;
  templateCount: number;
  testSequences: DatasetCounts;
  trainSequences: DatasetCounts;
  detectionSequences: number;
  knowledge: {
    train: { total: number; shipped: number; sampled: boolean };
    test: { total: number; shipped: number; sampled: boolean };
  };
};

export type DatasetManifest = Record<string, DatasetManifestEntry>;

export function isDatasetKey(value: unknown): value is DatasetKey {
  return typeof value === "string" && (DATASET_KEYS as readonly string[]).includes(value);
}

export function datasetInfo(key: DatasetKey): DatasetInfo {
  return DATASETS.find((d) => d.key === key) ?? DATASETS[0];
}

export function datasetFile(key: DatasetKey, file: DatasetFile): string {
  return withBase(`data/${key}/${file}.csv`);
}

export function manifestUrl(): string {
  return withBase("data/manifest.json");
}
