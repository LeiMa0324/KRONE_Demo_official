import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_DATASET,
  datasetFile,
  datasetInfo,
  isDatasetKey,
  manifestUrl,
} from "@/datasets";
import type {
  DatasetFile,
  DatasetInfo,
  DatasetKey,
  DatasetManifest,
  DatasetManifestEntry,
} from "@/datasets";

const STORAGE_KEY = "krone.dataset";

type DatasetContextValue = {
  dataset: DatasetKey;
  setDataset: (key: DatasetKey) => void;
  info: DatasetInfo;
  /** Row totals for the active dataset, or null until manifest.json lands. */
  stats: DatasetManifestEntry | null;
  /** Public URL of one of the active dataset's CSVs. */
  fileFor: (file: DatasetFile) => string;
};

const DatasetContext = createContext<DatasetContextValue | undefined>(undefined);

function readInitialDataset(): DatasetKey {
  // ?dataset=BGL wins over the remembered choice, so a link can open the demo on
  // a particular dataset.
  try {
    const requested = new URLSearchParams(window.location.search).get("dataset");
    if (isDatasetKey(requested)) return requested;
  } catch {
    // No URL to read; fall through to the stored choice.
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDatasetKey(stored)) return stored;
  } catch {
    // Private browsing, or localStorage otherwise unavailable.
  }
  return DEFAULT_DATASET;
}

export const DatasetProvider = ({ children }: { children: ReactNode }) => {
  const [dataset, setDatasetState] = useState<DatasetKey>(readInitialDataset);
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(manifestUrl())
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: { datasets: DatasetManifestEntry[] }) => {
        if (cancelled) return;
        const byKey: DatasetManifest = {};
        for (const entry of json.datasets || []) byKey[entry.key] = entry;
        setManifest(byKey);
      })
      .catch((error) => {
        // The pages all render without it; only the "showing N of M" notes go quiet.
        console.error("Could not load the dataset manifest:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setDataset = useCallback((key: DatasetKey) => {
    setDatasetState(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Not being able to remember the choice is not worth failing the switch over.
    }
  }, []);

  // Kept stable across manifest arrival so that the effects keyed on it -- the
  // CSV fetches -- do not fire a second time when the row counts land.
  const fileFor = useCallback((file: DatasetFile) => datasetFile(dataset, file), [dataset]);

  const value = useMemo<DatasetContextValue>(
    () => ({
      dataset,
      setDataset,
      info: datasetInfo(dataset),
      stats: manifest?.[dataset] ?? null,
      fileFor,
    }),
    [dataset, setDataset, manifest, fileFor]
  );

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
};

export const useDataset = (): DatasetContextValue => {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error("useDataset must be used within a DatasetProvider");
  }
  return context;
};
