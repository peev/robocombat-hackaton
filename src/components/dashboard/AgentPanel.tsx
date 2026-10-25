"use client";

import { useEffect, useRef, useState } from "react";
import type { MissionId } from "@/lib/simulation/types";

interface LogEntry {
  id: string;
  t: number;
  source: "openclaw-chat" | "openclaw-cron" | "openclaw-heartbeat" | "ui";
  kind: "run" | "report" | "note" | "chat";
  title: string;
  body: string;
  experimentId?: string;
  mission?: MissionId;
  severity?: "info" | "warn" | "critical";
}

interface OpenClawStatus {
  installed: boolean;
  gatewayUp: boolean;
  port: number;
  agentId: string;
  model: string | null;
  cronJobs: { name: string; schedule: string; enabled: boolean }[];
  heartbeatMinutes: number | null;
}

export interface AgentRun {
  experimentId: string;
  mission: MissionId;
  title: string;
  body: string;
  source: LogEntry["source"];
}

const SOURCE_BADGE: Record<LogEntry["source"], { label: string; cls: string }> = {
  "openclaw-chat": { label: "CHAT", cls: "bg-[#76b900]/20 text-[#76b900]" },
  "openclaw-cron": { label: "SCHEDULED", cls: "bg-sky-500/20 text-sky-300" },
  "openclaw-heartbeat": { label: "HEARTBEAT", cls: "bg-violet-500/20 text-violet-300" },
  ui: { label: "OPERATOR", cls: "bg-white/10 text-white/70" },
};

const SEVERITY_CLS = { info: "border-white/10", warn: "border-amber-400/60", critical: "border-[#e10600]" };

function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function AgentPanel({
  onNewRuns,
  onWatch,
}: {
  onNewRuns: (runs: AgentRun[]) => void;
  onWatch: (run: AgentRun) => void;
}) {
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState<number | null>(null);
  const [error, setError] = useState("");
  const seen = useRef<Set<string> | null>(null);
  const newRunsRef = useRef(onNewRuns);
  newRunsRef.current = onNewRuns;
  const [, force] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const data = await (await fetch("/api/agent")).json();
        if (!alive) return;
        setStatus(data.openclaw);
        const entries: LogEntry[] = data.log ?? [];
        setLog(entries);
        if (seen.current === null) {
          seen.current = new Set(entries.map((e) => e.id));
          return;
        }
        const fresh = entries.filter((e) => !seen.current!.has(e.id));
        fresh.forEach((e) => seen.current!.add(e.id));
        const runs = fresh
          .filter((e) => e.kind === "run" && e.experimentId && e.mission)
          .reverse()
          .map((e) => ({
            experimentId: e.experimentId!,
            mission: e.mission!,
            title: e.title,
            body: e.body,
            source: e.source,
          }));
        if (runs.length) newRunsRef.current(runs);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 2500);
    const clock = setInterval(() => force((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(clock);
    };
  }, []);

  const send = async () => {
    const message = input.trim();
    if (!message || thinking) return;
    setInput("");
    setError("");
    setThinking(Date.now());
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Agent error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent error");
    } finally {
      setThinking(null);
    }
  };

  const live = status?.gatewayUp;
  const sweep = status?.cronJobs.find((j) => /robocombat/i.test(j.name));

  return (
    <section className="panel flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h2 className="panel-title flex items-center gap-2 text-[#76b900]">
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-[#76b900]" : "bg-[#e10600]"}`} />
          OPENCLAW AGENT · {live ? "ALWAYS ON" : "OFFLINE"}
        </h2>
        <span className="font-mono text-[10px] text-white/40">{status?.model ?? "—"}</span>
      </header>

      <div className="grid grid-cols-3 gap-1 text-center text-[9px] uppercase tracking-wide text-white/50">
        <div className="rounded-sm bg-white/5 px-1 py-1">
          <div className="font-mono text-[11px] normal-case text-white">BlackBox</div>
          agent
        </div>
        <div className="rounded-sm bg-white/5 px-1 py-1">
          <div className="font-mono text-[11px] normal-case text-white">{sweep ? sweep.schedule : "—"}</div>
          regression sweep
        </div>
        <div className="rounded-sm bg-white/5 px-1 py-1">
          <div className="font-mono text-[11px] normal-case text-white">
            {status?.heartbeatMinutes ? `every ${status.heartbeatMinutes} min` : "—"}
          </div>
          heartbeat
        </div>
      </div>

      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask BlackBox… e.g. Why does Atlas struggle in smoke?"
          className="min-w-0 flex-1 rounded-sm border border-white/15 bg-black px-2 py-1.5 text-xs text-white placeholder:text-white/30"
          disabled={!!thinking}
        />
        <button type="submit" className="btn" disabled={!!thinking || !input.trim()}>
          Send
        </button>
      </form>
      {thinking && (
        <p className="text-[10px] text-[#76b900]">
          ◌ BlackBox is working on the GB10 (local gpt-oss)… {Math.round((Date.now() - thinking) / 1000)}s
        </p>
      )}
      {error && <p className="text-[10px] text-[#e10600]">{error}</p>}

      <ul className="flex max-h-[300px] flex-col gap-1 overflow-y-auto pr-1">
        {log.length === 0 && <li className="text-[10px] text-white/40">No agent activity yet.</li>}
        {log.map((e) => {
          const badge = SOURCE_BADGE[e.source];
          return (
            <li key={e.id} className={`border-l-2 bg-white/[0.03] px-2 py-1 ${SEVERITY_CLS[e.severity ?? "info"]}`}>
              <div className="flex items-center gap-1.5 text-[9px]">
                <span className={`rounded-sm px-1 py-px font-semibold tracking-wider ${badge.cls}`}>{badge.label}</span>
                <span className="uppercase tracking-wider text-white/40">{e.kind}</span>
                <span className="ml-auto text-white/30">{ago(e.t)}</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-white/90">{e.title}</p>
              <p className="line-clamp-4 whitespace-pre-line text-[10px] text-white/60">{e.body}</p>
              {e.kind === "run" && e.experimentId && e.mission && (
                <button
                  type="button"
                  className="mt-0.5 text-[10px] uppercase tracking-wider text-[#76b900] hover:underline"
                  onClick={() =>
                    onWatch({
                      experimentId: e.experimentId!,
                      mission: e.mission!,
                      title: e.title,
                      body: e.body,
                      source: e.source,
                    })
                  }
                >
                  ▶ Watch in 3D
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
