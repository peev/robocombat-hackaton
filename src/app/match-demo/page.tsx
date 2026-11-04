"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { MatchCanvas } from "@/components/match/MatchCanvas";
import { createDemoMatchConfig, CONTROL_INSTRUCTIONS } from "@/lib/match/config";
import { DISCLAIMER } from "@/lib/match/types";

export default function MatchDemoPage() {
  const [config] = useState(() => createDemoMatchConfig());
  const [showIntro, setShowIntro] = useState(true);
  const [matchKey, setMatchKey] = useState(0);

  const handleStart = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handleMatchEnd = useCallback((winner: string | null, scores: Record<string, number>) => {
    console.log("Match ended:", { winner, scores });
  }, []);

  const _handleRestart = useCallback(() => {
    setMatchKey((k) => k + 1);
  }, []);
  void _handleRestart;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <header className="z-20 flex shrink-0 items-center gap-4 border-b border-white/10 bg-gradient-to-r from-black via-[#141414] to-black px-4 py-2">
        <Link href="/" className="flex flex-col leading-none transition-opacity hover:opacity-80">
          <span className="font-display text-xl tracking-[0.15em] text-white">ROBOCOMBAT</span>
          <span className="text-[10px] tracking-[0.35em] text-[#e10600]">MATCH DEMO</span>
        </Link>
        <span className="hidden text-[11px] text-white/40 md:inline">
          ZONE CONTROL · INVESTOR/MEDIA DEMONSTRATION
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="rounded bg-amber-500/20 px-2 py-1 text-[10px] uppercase tracking-wider text-amber-400">
            ILLUSTRATIVE SIMULATION
          </span>
          <Link
            href="/"
            className="rounded border border-white/20 bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10"
          >
            ← Back to BlackBox
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        {showIntro ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="max-w-2xl text-center">
              <h1 className="font-display text-5xl tracking-[0.2em] text-white md:text-7xl">
                ROBOCOMBAT
              </h1>
              <p className="mt-2 text-sm tracking-[0.45em] text-[#e10600] md:text-base">
                MATCH DEMO
              </p>
              <p className="mt-6 text-lg text-white/70">
                THE ULTIMATE TEST OF PHYSICAL AI
              </p>

              <div className="mt-8 rounded-lg border border-white/10 bg-black/40 p-6 text-left">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/80">
                  About This Demo
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-white/60">
                  This is an <strong className="text-white/80">illustrative simulation</strong> of a
                  RoboCombat zone control match. Two teams of humanoid robots compete to capture and
                  hold scoring zones. You will pilot one robot using keyboard controls while AI
                  controls the others.
                </p>
                <ul className="mb-4 space-y-2 text-sm text-white/60">
                  <li className="flex items-start gap-2">
                    <span className="text-[#e10600]">▸</span>
                    <span>
                      <strong className="text-white/80">Objective:</strong> Capture zones by standing
                      in them. Hold zones to score points.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#e10600]">▸</span>
                    <span>
                      <strong className="text-white/80">Duration:</strong> 90-second match
                      (configurable)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#e10600]">▸</span>
                    <span>
                      <strong className="text-white/80">Teams:</strong> 2 robots per team (4 total)
                    </span>
                  </li>
                </ul>

                <div className="rounded bg-black/40 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-white/50">
                    {CONTROL_INSTRUCTIONS}
                  </pre>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStart}
                className="mt-8 rounded bg-[#e10600] px-8 py-3 text-lg font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#ff1a1a]"
              >
                START MATCH DEMO
              </button>

              <p className="mt-4 text-[10px] uppercase tracking-widest text-white/30">
                {DISCLAIMER}
              </p>
            </div>
          </div>
        ) : (
          <MatchCanvas
            key={matchKey}
            config={config}
            onMatchEnd={handleMatchEnd}
          />
        )}
      </main>
    </div>
  );
}
