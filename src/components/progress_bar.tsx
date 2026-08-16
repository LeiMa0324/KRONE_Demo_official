/**
 * The one progress bar. Three had grown independently across the sequence
 * pages, each reaching for whichever semantic colour was nearby -- green for
 * batch processing, amber for detection and again for training storage -- so
 * "how far along" was being told in colours that mean something else in every
 * visualisation on the same screen. Progress is chrome, not data, so it gets
 * the brand's colour and no vocabulary of its own.
 */
export const ProgressBar = ({
  value,
  label,
  note,
}: {
  /** 0-100. */
  value: number;
  label?: string;
  /** Right-aligned counterpart to the label -- a result, a count. */
  note?: React.ReactNode;
}) => (
  <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
    {(label || note) && (
      <div
        style={{
          color: "var(--n-700)",
          fontSize: "var(--font-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>{label}</span>
        {note}
      </div>
    )}

    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  </div>
);
