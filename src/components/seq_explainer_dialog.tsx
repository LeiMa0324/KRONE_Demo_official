import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The pause in the middle of a knowledge-base save animation.
 *
 * The three save steps used to run straight through: a lot of nodes lit up in
 * order and then a dialog reported a count. A visitor who did not already know
 * what a status-seq was learned nothing from watching it. This stops after the
 * first one is stored, with that one spelled out -- the sequence itself, the
 * node it is ground truth for, and the log keys and templates it stands for --
 * and resumes when they say they have read it.
 */
export type SeqExplainerLevel = "status" | "action" | "entity";

export type SeqExplainer = {
  level: SeqExplainerLevel;
  /** The node this sequence is stored as normal ground truth for. */
  parentLabel: string;
  /** The sequence itself: the node names, in order. */
  nodeSequence: string[];
  logKeys: string[];
  logTemplates: string[];
};

/**
 * Two sentences, deliberately split: the first says what the sequence is, the
 * second says what KRONE does with it. Running them together was making the
 * second half -- the part that explains why any of this is being stored -- read
 * as a qualifier on the first.
 */
const COPY: Record<
  SeqExplainerLevel,
  {
    title: string;
    whatItIs: string;
    whatItIsFor: string;
    parentRow: string;
    parentHelp: string;
    indexPhrase: string;
    seqRow: string;
    seqHelp: string;
  }
> = {
  status: {
    title: "This is a status-level Krone-seq",
    whatItIs: "This is the transition of statuses of an action.",
    whatItIsFor:
      "KRONE takes the status transitions decomposed from the training set as the ground-truth normal behaviour of this action.",
    parentRow: "Parent Action Node",
    parentHelp: "The action node this run of statuses belongs to.",
    indexPhrase: "parent action node + log key sequence",
    seqRow: "Status Node Sequence",
    seqHelp: "The sequence of status nodes under that action.",
  },
  action: {
    title: "This is an action-level Krone-seq",
    whatItIs: "This is the transition of actions of an entity.",
    whatItIsFor:
      "KRONE takes the action transitions decomposed from the training set as the ground-truth normal behaviour of this entity.",
    parentRow: "Parent Entity Node",
    parentHelp: "The entity node this run of actions belongs to.",
    indexPhrase: "parent entity node + log key sequence",
    seqRow: "Action Node Sequence",
    seqHelp: "The sequence of action nodes under that entity.",
  },
  entity: {
    title: "This is an entity-level Krone-seq",
    whatItIs: "This is the transition of entities of the root, spanning the whole log sequence.",
    whatItIsFor:
      "KRONE takes the entity transitions decomposed from the training set as the ground-truth normal behaviour of this root.",
    parentRow: "Parent Root Node",
    parentHelp: "The root node this run of entities belongs to.",
    indexPhrase: "root node + log key sequence",
    seqRow: "Entity Node Sequence",
    seqHelp: "The sequence of entity nodes under that root.",
  },
};

/** The phrase the second sentence exists to land; picked out in all three. */
const GROUND_TRUTH_PHRASE = "ground-truth normal behaviour";

const LOG_KEY_HELP = "The sequence of the corresponding log keys.";

const LOG_TEMPLATE_HELP = "The sequence of the corresponding log templates.";

const PREVIEW_COUNT = 6;

/**
 * The row labels are the demo's vocabulary, and a visitor meeting "Krone-seq"
 * for the first time has no way to tell a status node sequence from a log key
 * sequence. Each label carries its definition rather than the dialog growing a
 * paragraph nobody reads.
 */
const InfoTip = ({ text }: { text: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
        }}
        style={{
          width: 15,
          height: 15,
          borderRadius: "var(--r-pill)",
          border: "1px solid var(--n-300)",
          background: "var(--n-0)",
          color: "var(--n-500)",
          fontSize: 10,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          padding: 0,
        }}
      >
        ?
      </button>

      {isOpen && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1,
            width: "max-content",
            maxWidth: 280,
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--n-300)",
            background: "var(--n-0)",
            boxShadow: "var(--e2)",
            color: "var(--n-700)",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "left",
            whiteSpace: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

/** A sequence that may be long: shows the head, and opens on request. */
const ExpandableList = ({ items, mono }: { items: string[]; mono?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = items.length > PREVIEW_COUNT;
  const shown = isLong && !isExpanded ? items.slice(0, PREVIEW_COUNT) : items;

  if (!items.length) return <span style={{ color: "var(--n-500)" }}>—</span>;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6, minWidth: 0 }}>
      {shown.map((item, index) => (
        <span key={`${item}-${index}`} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
              color: "var(--n-900)",
              wordBreak: "break-word",
            }}
          >
            {item}
          </span>
          {index < shown.length - 1 && (
            <span aria-hidden="true" style={{ color: "var(--n-400)" }}>→</span>
          )}
        </span>
      ))}

      {isLong && (
        <button type="button" className="row-toggle" aria-expanded={isExpanded} onClick={() => setIsExpanded((open) => !open)}>
          {isExpanded ? "Collapse" : `Expand (${items.length - PREVIEW_COUNT} more)`}
        </button>
      )}
    </div>
  );
};

/**
 * The two rows that together form the retrieval key. They are not adjacent --
 * the table is ordered to be read, parent then sequence then keys then
 * templates -- so the pairing is marked on the rows themselves rather than
 * drawn as a bracket down the side.
 */
const IndexBadge = () => (
  <span
    title="At detection time this Krone-seq is looked up by parent node + log key sequence"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "0 7px",
      height: 17,
      borderRadius: "var(--r-pill)",
      border: "1px solid var(--brand-100)",
      background: "var(--brand-50)",
      color: "var(--brand-700)",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}
  >
    <span aria-hidden="true">⌕</span>
    index
  </span>
);

export const KroneSeqRow = ({
  label,
  help,
  isIndexKey,
  startsGroup,
  children,
}: {
  label: string;
  help: string;
  isIndexKey?: boolean;
  /** Heavier rule above: this row begins a different kind of content. */
  startsGroup?: boolean;
  children: React.ReactNode;
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(140px, 240px) minmax(0, 1fr)",
      columnGap: 16,
      alignItems: "baseline",
      padding: "10px 0",
      borderTop: startsGroup ? "2px solid var(--n-300)" : "1px solid var(--table-cell-border)",
      marginTop: startsGroup ? 6 : undefined,
      paddingTop: startsGroup ? 14 : undefined,
      fontSize: "var(--font-sm)",
      // The index rows are tinted the whole width, so the pair reads as one
      // thing even with a row between them.
      background: isIndexKey ? "var(--brand-50)" : undefined,
    }}
  >
    <div style={{ color: "var(--text-label)", textAlign: "left", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {label}
      <InfoTip text={help} />
      {isIndexKey && <IndexBadge />}
    </div>
    <div style={{ minWidth: 0, textAlign: "left" }}>{children}</div>
  </div>
);

/**
 * The four rows that describe one Krone-seq. Shared so that the Krone-seq the
 * detection page could *not* find is presented in exactly the same shape as the
 * one the training page just stored -- the comparison is the point.
 */
export const KroneSeqTable = ({
  explainer,
  markIndexRows = false,
  children,
}: {
  explainer: SeqExplainer;
  markIndexRows?: boolean;
  /** Extra rows appended in the same format. */
  children?: React.ReactNode;
}) => {
  const copy = COPY[explainer.level];

  return (
    <>
      <KroneSeqRow label={copy.parentRow} help={copy.parentHelp} isIndexKey={markIndexRows}>
        <b style={{ color: "var(--n-900)", fontWeight: 600 }}>{explainer.parentLabel || "—"}</b>
      </KroneSeqRow>
      <KroneSeqRow label={copy.seqRow} help={copy.seqHelp}>
        <ExpandableList items={explainer.nodeSequence} />
      </KroneSeqRow>
      <KroneSeqRow label="Log Key Sequence" help={LOG_KEY_HELP} isIndexKey={markIndexRows}>
        <ExpandableList items={explainer.logKeys} mono />
      </KroneSeqRow>
      <KroneSeqRow label="Log Template Sequence" help={LOG_TEMPLATE_HELP}>
        <ExpandableList items={explainer.logTemplates} />
      </KroneSeqRow>
      {children}
    </>
  );
};

export const SeqExplainerDialog = ({
  explainer,
  onDismiss,
}: {
  explainer: SeqExplainer | null;
  onDismiss: () => void;
}) => {
  // Retrieval is a second concept, and the dialog's first job is "what is a
  // Krone-seq". It stays behind a disclosure so the first read is one idea, and
  // the button reveals the sentence and the row markings together -- the badges
  // mean nothing without the sentence that names them.
  const [showRetrieval, setShowRetrieval] = useState(false);
  useEffect(() => {
    if (explainer) setShowRetrieval(false);
  }, [explainer]);

  if (!explainer) return null;
  const copy = COPY[explainer.level];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(28, 25, 25, 0.34)",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "var(--n-0)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--e3)",
          padding: "20px 22px 18px 22px",
          // #root centres its text, and that inherits all the way down here --
          // which was quietly centring every row label in the table below.
          textAlign: "left",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "var(--font-xl)", fontWeight: 700, color: "var(--n-900)", textAlign: "center" }}>
          {copy.title}
        </h2>
        <p style={{ margin: "10px 0 0 0", fontSize: "var(--font-sm)", lineHeight: 1.6, color: "var(--n-900)" }}>
          {copy.whatItIs}
        </p>
        <p style={{ margin: "6px 0 4px 0", fontSize: "var(--font-sm)", lineHeight: 1.6, color: "var(--n-900)" }}>
          {copy.whatItIsFor.split(GROUND_TRUTH_PHRASE)[0]}
          <b style={{ color: "var(--brand-600)", fontWeight: 700 }}>{GROUND_TRUTH_PHRASE}</b>
          {copy.whatItIsFor.split(GROUND_TRUTH_PHRASE)[1]}
        </p>
        {/* One label with a rotating chevron rather than a label that flips to
            "Hide ...": the question is what the disclosure is about, and it
            stays true whether it is open or shut. */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={showRetrieval}
            onClick={() => setShowRetrieval((open) => !open)}
          >
            How is this used at detection time?
            <ChevronDown
              size={13}
              aria-hidden="true"
              style={{
                transform: showRetrieval ? "rotate(180deg)" : "none",
                transition: "transform 0.14s ease",
              }}
            />
          </button>
        </div>

        {showRetrieval && (
          <ol
            style={{
              margin: "10px 0 4px 0",
              padding: 0,
              listStyle: "none",
              display: "grid",
              rowGap: 8,
              fontSize: "var(--font-sm)",
              lineHeight: 1.55,
              color: "var(--n-900)",
              textAlign: "left",
            }}
          >
            {([
              [
                "Index",
                <>
                  Looked up by{" "}
                  <b style={{ color: "var(--brand-600)", fontWeight: 700 }}>{copy.indexPhrase}</b> — the two rows
                  marked <b style={{ color: "var(--brand-700)", fontWeight: 700 }}>index</b>.
                </>,
              ],
              [
                "Pattern matching",
                <>A hit passes as normal; a miss is flagged <b style={{ fontWeight: 700 }}>potentially abnormal</b>.</>,
              ],
              [
                "LLM verification",
                <>The Krone-seqs stored under the same node go to the LLM as <b style={{ fontWeight: 700 }}>in-context examples</b> of what normal looks like there.</>,
              ],
            ] as const).map(([label, body], index) => (
              <li key={label} style={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", columnGap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: 2,
                    width: 18,
                    height: 18,
                    borderRadius: "var(--r-pill)",
                    background: "var(--n-100)",
                    color: "var(--n-700)",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {index + 1}
                </span>
                <span>
                  <b style={{ fontWeight: 700 }}>{label}</b> — {body}
                </span>
              </li>
            ))}
          </ol>
        )}

        <KroneSeqTable explainer={explainer} markIndexRows={showRetrieval} />

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
          <button type="button" className="btn btn-wide btn-sq btn-primary" onClick={onDismiss} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
