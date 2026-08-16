import { useEffect, useRef, useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import { useDataset } from "@/DatasetContext";
import { DATASETS } from "@/datasets";

/**
 * The demo's one dataset switch. It sits on the homepage next to the try-out
 * button so that visitors pick the dataset as they enter the demo; the choice is
 * remembered by DatasetProvider and carries through every page from hierarchy
 * mining to cost analysis.
 */
export const DatasetSelector = ({ className = "" }: { className?: string }) => {
  const { dataset, setDataset, info } = useDataset();

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        role="radiogroup"
        aria-label="Active dataset"
        className="flex items-center gap-1 rounded-full border border-white/30 bg-black/30 p-1 backdrop-blur-sm"
      >
        <span className="flex items-center gap-1.5 px-3 font-WPIfont text-xs uppercase tracking-wider text-white/70">
          <Database className="w-4 h-4 shrink-0" aria-hidden="true" />
          Dataset
        </span>
        {DATASETS.map((option) => {
          const isActive = option.key === dataset;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={option.description}
              onClick={() => setDataset(option.key)}
              className={`rounded-full px-4 py-1.5 font-WPIfont text-sm font-semibold transition
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                            isActive
                              ? "bg-white text-WPIRed shadow"
                              : "text-white/80 hover:bg-white/15 hover:text-white"
                          }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="font-WPIfont text-xs text-white/70">{info.description}</p>
    </div>
  );
};

/**
 * The same switch, sized for the step rails on the data pages. It reads as a
 * finished step ("Dataset: HDFS ✓") rather than as a question, because by the
 * time a visitor is on these pages the question was answered on the homepage.
 * Switching from here resets the pipeline, since App.tsx keys the routes on the
 * dataset and remounts them.
 */
export const DatasetChip = () => {
  const { dataset, setDataset, info } = useDataset();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="step-chip"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={info.description}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Database size={12} aria-hidden="true" />
        <b style={{ color: "var(--n-900)", fontWeight: 600 }}>{info.label}</b>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            minWidth: 230,
            padding: 6,
            background: "var(--n-0)",
            border: "1px solid var(--n-300)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--e2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px 8px 8px",
              color: "var(--n-500)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Switch dataset
          </div>
          {DATASETS.map((option) => {
            const isActive = option.key === dataset;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setIsOpen(false);
                  if (!isActive) setDataset(option.key);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "7px 8px",
                  border: "none",
                  borderRadius: "var(--r-sm)",
                  background: isActive ? "var(--brand-50)" : "transparent",
                  color: isActive ? "var(--brand-700)" : "var(--n-700)",
                  fontSize: "var(--font-sm)",
                  fontWeight: isActive ? 600 : 400,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {option.label}
                <span style={{ display: "block", color: "var(--n-500)", fontSize: 11, fontWeight: 400 }}>
                  {option.description}
                </span>
              </button>
            );
          })}
          <p style={{ margin: 0, padding: "6px 8px 2px 8px", color: "var(--n-500)", fontSize: 11 }}>
            Switching reloads the pipeline from step 2.
          </p>
        </div>
      )}
    </div>
  );
};
