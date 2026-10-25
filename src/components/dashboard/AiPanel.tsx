"use client";

export function AiPanel({
  status,
  analyses,
  summary,
  mode,
}: {
  status: string;
  analyses: string[];
  summary: string;
  mode: string | null;
}) {
  return (
    <section className="panel">
      <h2 className="panel-title">AI EVALUATOR</h2>
      <div className="mb-2 flex items-center gap-2 text-[10px]">
        <span
          className={`h-2 w-2 rounded-full ${
            mode === "local-llm"
              ? "bg-[#76b900]"
              : mode === "heuristic-fallback"
                ? "bg-amber-500"
                : "bg-white/30"
          }`}
        />
        <span className="text-white/60">{status}</span>
      </div>
      {mode && (
        <div className="mb-2 text-[10px] uppercase tracking-wide text-white/40">
          Mode: {mode}
        </div>
      )}
      <div className="max-h-48 space-y-2 overflow-y-auto text-xs leading-relaxed text-white/80">
        {analyses.map((a, i) => (
          <p key={i} className="rounded bg-white/5 p-2">
            {a}
          </p>
        ))}
        {!analyses.length && (
          <p className="text-white/40">
            Agent idle. Launch AI Evaluation to analyze measured results and design follow-up experiments.
          </p>
        )}
      </div>
      {summary && (
        <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-[#76b900]">
          {summary}
        </p>
      )}
    </section>
  );
}
