import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DatasetKey } from "@/datasets";

/**
 * Krone-seqs the visitor has added during this session.
 *
 * The demo ships precomputed knowledge bases, so "Add to Knowledge Base" used
 * to be a toast and nothing more -- walk to the knowledge base page afterwards
 * and the sequence you just saved was not there. This holds the additions in
 * session memory so the knowledge base page can merge them into what it loaded
 * from CSV, creating the tree path they hang off if the shipped tree has no
 * node for it.
 *
 * Session-scoped on purpose: the CSVs under public/ are read-only, and a demo
 * that quietly accumulated state across reloads would be harder to reason about
 * than one that starts clean.
 */
export type KroneSeqAddition = {
  dataset: DatasetKey;
  /** Where it hangs in the tree. */
  entityId: string;
  actionId: string;
  /** The status node names, in order -- the sequence itself. */
  nodeSequence: string[];
  logKeys: string[];
  /** One per status node, so a missing tree node can be created in full. */
  statusNodes: Array<{ name: string; eventId: string; logTemplate: string }>;
  explanation: string;
  isAnomaly: boolean;
};

type KnowledgeBaseAdditionsValue = {
  additions: KroneSeqAddition[];
  addKroneSeq: (addition: KroneSeqAddition) => void;
  /** True if a sequence with this log key run is already stored for the dataset. */
  hasKroneSeq: (dataset: DatasetKey, logKeys: string[]) => boolean;
};

const KnowledgeBaseAdditionsContext = createContext<KnowledgeBaseAdditionsValue | undefined>(undefined);

const logKeyId = (logKeys: string[]) => logKeys.join(",");

export const KnowledgeBaseAdditionsProvider = ({ children }: { children: ReactNode }) => {
  const [additions, setAdditions] = useState<KroneSeqAddition[]>([]);

  const addKroneSeq = useCallback((addition: KroneSeqAddition) => {
    setAdditions((previous) => {
      const already = previous.some(
        (entry) =>
          entry.dataset === addition.dataset &&
          entry.actionId === addition.actionId &&
          logKeyId(entry.logKeys) === logKeyId(addition.logKeys)
      );
      return already ? previous : [...previous, addition];
    });
  }, []);

  const hasKroneSeq = useCallback(
    (dataset: DatasetKey, logKeys: string[]) =>
      additions.some((entry) => entry.dataset === dataset && logKeyId(entry.logKeys) === logKeyId(logKeys)),
    [additions]
  );

  const value = useMemo(
    () => ({ additions, addKroneSeq, hasKroneSeq }),
    [additions, addKroneSeq, hasKroneSeq]
  );

  return (
    <KnowledgeBaseAdditionsContext.Provider value={value}>{children}</KnowledgeBaseAdditionsContext.Provider>
  );
};

export const useKnowledgeBaseAdditions = (): KnowledgeBaseAdditionsValue => {
  const context = useContext(KnowledgeBaseAdditionsContext);
  if (!context) {
    throw new Error("useKnowledgeBaseAdditions must be used within a KnowledgeBaseAdditionsProvider");
  }
  return context;
};
